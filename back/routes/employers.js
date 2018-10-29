const express = require('express')

const router = express.Router()
const { transaction } = require('objection')

const { upload, uploadDestination } = require('../lib/upload')
const { requireActiveMonth } = require('../lib/activeMonthMiddleware')
const { sendDeclaration } = require('../lib/pe-api/declaration')

const Declaration = require('../models/Declaration')
const Document = require('../models/Document')
const Employer = require('../models/Employer')
const ActivityLog = require('../models/ActivityLog')

const { DECLARATION_STATUSES } = require('../constants')

const getSanitizedEmployer = ({ employer, declaration, user }) => {
  const intWorkHours = parseInt(employer.workHours, 10)
  const intSalary = parseInt(employer.salary, 10)

  return {
    ...employer,
    userId: user.id,
    declarationId: declaration.id,
    // Save temp data as much as possible
    workHours: !Number.isNaN(intWorkHours) ? intWorkHours : null,
    salary: !Number.isNaN(intSalary) ? intSalary : null,
  }
}

router.get('/', requireActiveMonth, (req, res, next) => {
  Declaration.query()
    .eager('employers.document')
    .findOne({
      userId: req.session.user.id,
      monthId: req.activeMonth.id,
    })
    .then((declaration) => {
      if (!declaration) {
        return res.status(404).json('No declaration found')
      }

      res.json(declaration.employers)
    })
    .catch(next)
})

router.post('/', requireActiveMonth, (req, res, next) => {
  const sentEmployers = req.body.employers || []
  if (!sentEmployers.length) return res.status(400).json('No data')

  Declaration.query()
    .eager('employers')
    .findOne({
      userId: req.session.user.id,
      monthId: req.activeMonth.id,
    })
    .then((declaration) => {
      if (!declaration) {
        return res.status(400).json('Please send declaration first')
      }

      const newEmployers = sentEmployers.filter((employer) => !employer.id)
      const updatedEmployers = sentEmployers.filter(({ id }) =>
        declaration.employers.some((employer) => employer.id === id),
      )

      declaration.employers = newEmployers
        .concat(updatedEmployers)
        .map((employer) =>
          getSanitizedEmployer({
            employer,
            user: req.session.user,
            declaration,
          }),
        )

      const shouldLog =
        req.body.isFinished && !declaration.hasFinishedDeclaringEmployers

      if (!req.body.isFinished) {
        // Temp saving for the user to come back later
        return declaration
          .$query()
          .upsertGraph()
          .then(() => res.json(declaration))
      }

      declaration.hasFinishedDeclaringEmployers = true

      // Sending declaration to pe.fr
      return sendDeclaration({
        declaration,
        accessToken: req.session.userSecret.accessToken,
        ignoreErrors: req.body.ignoreErrors,
      })
        .then(({ body }) => {
          if (body.statut !== DECLARATION_STATUSES.SAVED) {
            // the service will answer with HTTP 200 for a bunch of errors, handling this right away

            declaration.hasFinishedDeclaringEmployers = false

            return declaration
              .$query()
              .upsertGraph()
              .then(() =>
                // This is a custom error, we want to show a different feedback to users
                res
                  .status(
                    body.statut === DECLARATION_STATUSES.TECH_ERROR ? 503 : 400,
                  )
                  .json({
                    consistencyErrors: body.erreursIncoherence || [],
                    validationErrors: Object.values(
                      body.erreursValidation || {},
                    ),
                  }),
              )
          }

          return transaction(Declaration.knex(), (trx) =>
            Promise.all([
              declaration.$query(trx).upsertGraph(),
              shouldLog
                ? ActivityLog.query(trx).insert({
                    userId: req.session.user.id,
                    action: ActivityLog.actions.VALIDATE_EMPLOYERS,
                    metadata: JSON.stringify({
                      declarationId: declaration.id,
                    }),
                  })
                : Promise.resolve(),
            ]),
          ).then(() => res.json(declaration))
        })
        .catch((err) => {
          // If we could not save the declaration on pe.fr
          // We still save the data the user sent us
          // but we put it as unfinished.
          declaration.hasFinishedDeclaringEmployers = false

          return declaration
            .$query()
            .upsertGraph()
            .then(() => {
              throw err
            })
        })
        .catch(next)
    })
})

router.get('/files', (req, res, next) => {
  if (!req.query.employerId) return res.status(400).json('Missing employerId')

  return Employer.query()
    .eager('document')
    .findOne({
      id: req.query.employerId,
      userId: req.session.user.id,
    })
    .then((employer) => {
      if (!employer) return res.status(404).json('No such employer')
      if (!employer.document || !employer.document.id)
        return res.status(404).json('No such file')
      res.sendFile(employer.document.file, { root: uploadDestination })
    })
    .catch(next)
})

router.post('/files', upload.single('document'), (req, res, next) => {
  if (!req.file && !req.body.skip) return res.status(400).json('Missing file')
  if (!req.body.employerId) return res.status(400).json('Missing employerId')

  return Employer.query()
    .eager('document')
    .findOne({
      id: req.body.employerId,
      userId: req.session.user.id,
    })
    .then((employer) => {
      if (!employer) return res.status(404).json('No such employer')

      // FIXME all the following should be replaced using an upsertGraph
      // which failed because of null value in column "id" violates not-null constraint
      // (also, validation of id field in model should probably be removed)

      return transaction(Employer.knex(), (trx) => {
        const documentFileObj = req.body.skip
          ? {
              // Used in case the user sent his file by another means.
              file: null,
              isTransmitted: true,
            }
          : { file: req.file.filename }

        const documentPromise = employer.document
          ? employer.document.$query().patch(documentFileObj)
          : Document.query().insert(documentFileObj)

        return documentPromise
          .returning('*')
          .then((savedDocument) =>
            employer
              .$query(trx)
              .patchAndFetch({ documentId: savedDocument.id })
              .eager('document'),
          )
          .then((savedEmployer) => res.json(savedEmployer))
      }).catch(next)
    })
})

module.exports = router
