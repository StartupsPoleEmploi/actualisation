const express = require('express')

const router = express.Router()
const crypto = require('crypto')
const superagent = require('superagent')
const jwt = require('jsonwebtoken')
const config = require('config')
const { pick, startCase, toLower } = require('lodash')
const Raven = require('raven')

const User = require('../models/User')

const { clientId, clientSecret, redirectUri, tokenHost, apiHost } = config

const DECLARATION_CONTEXT_ID = '1'

const realm = '/individu'

const credentials = {
  client: {
    id: clientId,
    secret: clientSecret,
  },
  auth: {
    tokenHost,
    tokenPath: '/connexion/oauth2/access_token?realm=%2Findividu',
    authorizePath: '/connexion/oauth2/authorize',
  },
  options: {
    bodyFormat: 'form',
    authorizationMethod: 'body',
  },
}

const oauth2 = require('simple-oauth2').create(credentials)

const tokenConfig = {
  redirect_uri: redirectUri,
  realm,
  scope: `application_${clientId} api_peconnect-individuv1 openid profile email api_peconnect-coordonneesv1 coordonnees api_peconnect-actualisationv1 individu api_peconnect-envoidocumentv1 document documentW`,
}

router.get('/', (req, res, next) => {
  req.session.regenerate((err) => {
    if (err) return next(err)

    const state = crypto.randomBytes(64).toString('hex')
    const nonce = crypto.randomBytes(64).toString('hex')

    req.session.state = state
    req.session.nonce = nonce

    const authorizationUri = oauth2.authorizationCode.authorizeURL({
      ...tokenConfig,
      nonce,
      state,
    })

    res.redirect(authorizationUri)
  })
})

router.get('/callback', (req, res, next) => {
  if (req.session.state !== req.query.state || !req.query.code) {
    return res.redirect('/?loginFailed')
  }

  oauth2.authorizationCode
    .getToken({
      redirect_uri: redirectUri,
      code: req.query.code,
    })
    .then((result) => oauth2.accessToken.create(result))
    .then((authToken) => {
      const tokenClaims = jwt.decode(authToken.token.id_token)

      if (!tokenClaims.iss.startsWith(tokenHost)) throw new Error('Wrong iss')
      if (tokenClaims.aud !== clientId) throw new Error('Wrong aud')
      if (tokenClaims.azp && tokenClaims.azp !== clientId)
        throw new Error('Wrong azp')
      if (tokenClaims.realm !== realm) throw new Error('Wrong realm')
      if (tokenClaims.nonce !== req.session.nonce)
        throw new Error('Wrong nonce')

      // https://www.emploi-store-dev.fr/portail-developpeur-cms/home/catalogue-des-api/documentation-des-api/utiliser-les-api/authorization-code-flow/securite-et-verification.html
      // TODO check access_token against at_hash here - possible code:
      // base64url(crypto.createHash('sha256').update(authToken.token.access_token).digest('hex'))

      req.session.userSecret = {
        accessToken: authToken.token.access_token,
        idToken: authToken.token.id_token,
      }

      console.log(
        `${apiHost}/partenaire/peconnect-envoidocument/v1/depose/contextes-accessibles`,

        `${apiHost}/partenaire/peconnect-envoidocument/v1/depose/contextes`,
      )

      return authToken
    })
    .then((authToken) =>
      Promise.all([
        superagent
          .get(`${apiHost}/partenaire/peconnect-individu/v1/userinfo`)
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken.token.access_token}`),
        superagent
          .get(`${apiHost}/partenaire/peconnect-actualisation/v1/actualisation`)
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken.token.access_token}`),
        superagent
          .get(
            `${apiHost}/partenaire/peconnect-envoidocument/v1/depose/contextes-accessibles`,
          )
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken.token.access_token}`)
          .set('Accept-Encoding', 'gzip'),
        superagent
          .get(`${apiHost}/partenaire/peconnect-coordonnees/v1/coordonnees`)
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken.token.access_token}`)
          .set('Accept-Encoding', 'gzip'),
      ]),
    )
    .then(
      ([
        { body: userinfo },
        { body: declarationData },
        { body: accessibleContexts },
        { body: coordinates },
      ]) => {
        console.log({ declarationData })
        const declarationContext = accessibleContexts.find(
          (context) => context.code === DECLARATION_CONTEXT_ID,
        )
        if (!declarationContext) {
          // We won't be able to send declaration documents!
          // Send a sentry report, and show an error to the user
        }
        const user = {
          peId: userinfo.sub,
          firstName: startCase(toLower(userinfo.given_name)),
          lastName: startCase(toLower(userinfo.family_name)),
          gender: userinfo.gender,
          pePostalCode: coordinates.codePostal,
        }
        if (userinfo.email) {
          // Do not override the email the user may have given us if there is
          // no email via PE Connect
          user.email = userinfo.email
        }
        return User.query()
          .findOne({ peId: user.peId })
          .then((dbUser) => {
            if (dbUser) {
              return dbUser
                .$query()
                .update(user)
                .returning('*')
            }
            return User.query()
              .insert(user)
              .returning('*')
          })
          .then((user) => {
            req.session.user = {
              ...pick(user, ['id', 'firstName', 'lastName', 'email', 'gender']),
              isAuthorizedForTests: config.authorizeAllUsers // For test environments
                ? true
                : !!user.peCode && !!user.pePass && !!user.pePostalCode,
              isWaitingForConfirmation: config.authorizeAllUsers // For test environments
                ? false
                : !!user.peCode && !user.pePass,
              canSendDocuments: !!declarationContext,
            }
            res.redirect('/')
          })
      },
    )
    .catch(next)
})

router.get('/logout', (req, res) => {
  // This is a path required by the user's browser, hence the redirection
  const { idToken } = req.session.userSecret || {}
  req.session.destroy((err) => Raven.captureException(err))
  res.redirect(
    `${
      config.tokenHost
    }/compte/deconnexion/compte/deconnexion?id_token_hint=${idToken}&redirect_uri=${
      config.appHost
    }`,
  )
})

module.exports = router
