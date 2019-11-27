const express = require('express')
const { format } = require('date-fns')
const zip = require('express-easy-zip')
const path = require('path')
const superagent = require('superagent')
const {
  get,
  isUndefined,
  kebabCase,
  difference,
  intersection,
} = require('lodash')
const { subDays } = require('date-fns')
const { uploadsDirectory: uploadDestination } = require('config')
const { Parser } = require('json2csv')
const { raw } = require('objection')

const { uploadCSV } = require('../lib/upload')
const { extractCSVContent } = require('../lib/files')
const {
  extractUserMails,
  extractCannotDeclaredUserEmails,
} = require('../lib/user')
const winston = require('../lib/log')
const { deleteUser } = require('../lib/user')
const mailjet = require('../lib/mailings/mailjet')
const { EXPORT_FIELDS } = require('../lib/exportUserList')

const ActivityLog = require('../models/ActivityLog')
const Declaration = require('../models/Declaration')

const DeclarationMonth = require('../models/DeclarationMonth')
const DeclarationReview = require('../models/DeclarationReview')

const User = require('../models/User')
const Status = require('../models/Status')

/*
  This is temporary behaviour while a test is conducted:
  We have some emails stored in a json file, and we prevent
  them from being authorized in Zen.
 */
let emailsToIgnore = []
try {
  /* eslint-disable-next-line */
  emailsToIgnore = require('../constants/users-to-ignore.json').map((email) =>
    email.toLowerCase(),
  )
} catch (e) {
  winston.warn('No user in list of users to ignore')
}

const router = express.Router()
router.use(zip())

router.get('/declarationsMonths', (req, res, next) => {
  DeclarationMonth.query()
    .where('startDate', '<=', new Date())
    .orderBy('startDate', 'desc')
    .then((declarationMonths) => res.json(declarationMonths))
    .catch(next)
})

router.get('/declarations', (req, res, next) => {
  if (!req.query.monthId) {
    return res.status(501).json('Must add monthId as query param')
  }

  Declaration.query()
    .eager('[user, employers, review, infos]')
    .where({ monthId: req.query.monthId })
    .then((declarations) => res.json(declarations))
    .catch(next)
})

router.get('/users', (req, res, next) => {
  const isAuthorized = req.query.authorized === 'true'

  return User.query()
    .where({ isAuthorized })
    .then((users) => {
      if ('csv' in req.query) {
        const json2csvParser = new Parser({ fields: EXPORT_FIELDS })
        const csv = json2csvParser.parse(users)

        res.set(
          'Content-disposition',
          `attachment; filename=utilisateurs-${
            !isAuthorized ? 'non-' : ''
          }autorisés-${format(new Date(), 'YYYY-MM-DD')}.csv`,
        )
        res.set('Content-type', 'text/csv')
        return res.send(csv)
      }

      return res.json(users)
    })
    .catch(next)
})

router.get('/users-with-declaration', (req, res, next) =>
  User.query()
    .whereIn(
      'id',
      Declaration.query()
        .distinct()
        .select('userId'),
    )
    .then((users) => {
      const json2csvParser = new Parser({ fields: EXPORT_FIELDS })
      const csv = json2csvParser.parse(users)

      res.set(
        'Content-disposition',
        `attachment; filename=utilisateurs-avec-declaration-${format(
          new Date(),
          'YYYY-MM-DD',
        )}.csv`,
      )
      res.set('Content-type', 'text/csv')
      return res.send(csv)
    })
    .catch(next),
)

router.post('/users/authorize', (req, res, next) => {
  const useEmails = Array.isArray(req.body.emails)
  if (!useEmails) {
    return res.status(400).json('Bad request')
  }

  const query = User.query()

  const emails = req.body.emails.filter(
    (email) => !emailsToIgnore.includes(email.toLowerCase()),
  )

  if (emails.length === 0) {
    return res.json({
      updatedRowsNb: 0,
    })
  }

  query.where(function() {
    this.where('email', 'ilike', emails[0])
    emails.slice(1).forEach((email) => {
      this.orWhere('email', 'ilike', email)
    })
  })

  // first get users to avoid sending "welcome" message to already subscribed users
  return query
    .andWhere('isAuthorized', false)
    .then((users) => {
      if (users.length === 0) return

      return mailjet
        .authorizeContactsAndSendConfirmationEmails({
          users,
          activeMonth: get(req.activeMonth, 'month'),
        })
        .then(() =>
          User.query()
            .patch({ isAuthorized: true })
            .whereIn(
              'id',
              users.map((user) => user.id),
            ),
        )
    })
    .then((updatedRowsNb = 0) =>
      res.json({
        updatedRowsNb,
      }),
    )
    .catch(next)
})

// get users *not* in db
router.post('/users/filter', (req, res, next) => {
  let emails
  try {
    emails = req.body.emails.map((email) => email.toLowerCase())
  } catch (err) {
    return next(err)
  }

  const query = User.query()

  query.where(function() {
    this.where('email', 'ilike', emails[0])
    emails.slice(1).forEach((email) => {
      this.orWhere('email', 'ilike', email)
    })
  })

  return query
    .then((usersInDb) => {
      const usersInDbEmails = usersInDb.map(({ email }) => email.toLowerCase())
      return res.json(
        emails.filter((email) => !usersInDbEmails.includes(email)),
      )
    })
    .catch(next)
})

router.post('/declarations/review', (req, res, next) => {
  if (
    !req.body.declarationId ||
    (!req.body.notes && isUndefined(req.body.isVerified))
  ) {
    return res.status(400).json('Incomplete request')
  }

  Declaration.query()
    .eager('review')
    .findById(req.body.declarationId)
    .then((declaration) => {
      const declarationNoteObj = {}

      if ('isVerified' in req.body) {
        declarationNoteObj.isVerified = req.body.isVerified
      }
      if ('notes' in req.body) {
        declarationNoteObj.notes = req.body.notes
      }

      if (declaration.review) {
        return declaration.review
          .$query()
          .patch(declarationNoteObj)
          .then(() => res.json('ok'))
      }

      return DeclarationReview.query()
        .insert({
          declarationId: req.body.declarationId,
          ...declarationNoteObj,
        })
        .then(() => res.json('ok'))
    })
    .catch(next)
})

// No login form for now, users must be inserted in db manually.
router.get('/activityLog', (req, res) => {
  ActivityLog.query()
    .eager('user')
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .then((logs) => res.json(logs))
})

router.get('/declarations/:declarationId/files', (req, res) => {
  Declaration.query()
    .eager(`[infos, employers.documents, user, declarationMonth]`)
    .findById(req.params.declarationId)
    .then((declaration) => {
      if (!declaration) return res.status(404).json('No such declaration')

      const formattedMonth = format(
        declaration.declarationMonth.month,
        'MM-YYYY',
      )

      const files = declaration.infos
        .map((info) => ({
          label: info.type,
          value: info.file,
        }))
        .concat(
          declaration.employers.map((employer) => ({
            label: `employer-${employer.employerName}`,
            value: get(employer, 'documents[0].file'),
          })),
        )
        .filter(({ value }) => value) // remove null values
        .map((file, key) => ({
          path: `${uploadDestination}${file.value}`,
          name: kebabCase(
            `${declaration.user.firstName}-${declaration.user.lastName}-${
              file.label
            }-${formattedMonth}-${String.fromCharCode(key + 97)}`, // identifier to avoid duplicates
          ).concat(
            // PE.fr uploads do not handle "jpeg" files (-_-), so renaming on the fly.
            path.extname(file.value) === '.jpeg'
              ? '.jpg'
              : path.extname(file.value),
          ),
        }))

      if (files.length === 0) return res.send('Pas de fichiers disponibles')

      res.zip({
        files,
        filename: `${declaration.user.firstName}-${
          declaration.user.lastName
        }-${formattedMonth}-fichiers-${
          declaration.isFinished ? 'validés' : 'non-validés'
        }.zip`,
      })
    })
})

router.post('/status', (req, res, next) =>
  Status.query()
    .update({ up: req.body.up })
    .returning('*')
    .then((result) => {
      const message = `Following action in administration interface, Zen is now *${
        req.body.up ? '' : 'de'
      }activated*`

      // No return for this promise : Slack being up or not should prevent us from sending back a 200
      superagent
        .post(process.env.SLACK_WEBHOOK_SU_ZEN, {
          text: message,
        })
        .catch((err) => winston.warn('Error sending message to Slack', err))

      return res.json(result[0])
    })
    .catch(next),
)

router.post(
  '/update-users-status',
  uploadCSV.single('document'),
  async (req, res, next) => {
    if (!req.file) return res.status(400).json('Missing file')

    try {
      // 1 - Retrieve data
      // CSV
      const extractCsv = await extractCSVContent(req.file.path)
      const csvEmails = extractCsv
        .filter((email) => email)
        .map((row) => row.email.toLowerCase())

      // All user emails
      const minimumDate = subDays(new Date(), 1)
      const usersEmails = await extractUserMails(minimumDate)

      // Users which have status canMakeDeclaration=false
      const cannotDeclaredUsersEmails = await extractCannotDeclaredUserEmails()

      // 2 - Handle data
      // Compute users allowed again and update their mailjet status
      // => Mark as not allowed in database but mark as allowed in CSV
      const emailsAllowedAgain = intersection(
        csvEmails,
        cannotDeclaredUsersEmails,
      )
      await mailjet.updateCanMakeDeclarationStatus({
        emails: emailsAllowedAgain,
        canMakeDeclaration: true,
      })

      // 2.1 - Update all users in database
      // Update users declaration in DB and in Mailjet
      await User.query().patch({
        canMakeMonthDeclaration: true,
        canMakeDeclaration: true,
      })
      const diffEmails = difference(usersEmails, csvEmails)
      await User.query()
        .patch({
          canMakeMonthDeclaration: false,
          canMakeDeclaration: false,
        })
        .whereIn(raw('LOWER(email)'), diffEmails)

      // 2.2 - Update property for these emails in mailjet
      await mailjet.updateCanMakeDeclarationStatus({
        emails: diffEmails,
        canMakeDeclaration: false,
      })
    } catch (err) {
      return next(err)
    }

    res.json('ok')
  },
)

router.post(
  '/update-declaration-users-status',
  uploadCSV.single('document'),
  async (req, res, next) => {
    if (!req.file) return res.status(400).json('Missing file')

    try {
      // 1 - Retrieve data
      // CSV
      const extractCsv = await extractCSVContent(req.file.path)
      const csvEmails = extractCsv
        .filter((email) => email)
        .map((row) => row.email.toLowerCase())

      // All user emails
      const minimumDate = subDays(new Date(), 1)
      const usersEmails = await extractUserMails(minimumDate)

      // 2 - Handle data
      const diffEmails = difference(usersEmails, csvEmails)
      // 1 - Update these users
      await User.query()
        .patch({ canMakeMonthDeclaration: false })
        .whereIn(raw('LOWER(email)'), diffEmails)
        .then(() => res.json('ok'))

      // 2 - Update mailjet user property for the current declaration month
      await mailjet.setDeclarationDoneForContacts({
        emails: diffEmails,
        activeMonth: req.activeMonth.month,
      })
    } catch (err) {
      return next(res)
    }

    res.json('ok')
  },
)

router.delete('/delete-user', (req, res, next) => {
  const { userId } = req.query
  if (!userId) throw new Error('No user id given')

  User.query()
    .eager('[employers.documents, declarations.[infos,review]]')
    .findById(userId)
    .then((user) => {
      if (!user) throw new Error('No such user id')
      return deleteUser(user)
    })
    .then(() => res.send('ok'))
    .catch(next)
})

module.exports = router
