import superagent from 'superagent'
import {
  FETCH_DECLARATIONS_SUCCESS,
  FETCH_DECLARATIONS_FAILURE,
  HIDE_EMPLOYER_FILE_PREVIEW,
  SHOW_EMPLOYER_FILE_PREVIEW,
  HIDE_INFO_FILE_PREVIEW,
  SHOW_INFO_FILE_PREVIEW,
  POST_DECLARATION_INFO_LOADING,
  FETCH_DECLARATION_SUCCESS,
  POST_DECLARATION_INFO_FAILURE,
  POST_EMPLOYER_DOC_LOADING,
  FETCH_EMPLOYER_SUCCESS,
  POST_EMPLOYER_DOC_FAILURE,
  FETCH_DECLARATIONS_LOADING,
  FETCH_ACTIVE_DECLARATION_LOADING,
  FETCH_ACTIVE_DECLARATION_SUCCESS,
  FETCH_ACTIVE_DECLARATION_FAILURE,
  SET_USER_LOGGED_OUT,
} from './actionNames'
import { MAX_PDF_PAGE } from '../constants'
import { utils } from '../selectors/declarations'
import { canUsePDFViewer } from '../lib/file'

const { findEmployer, findDeclarationInfo } = utils

export const fetchDeclarations = () => (dispatch) => {
  dispatch({ type: FETCH_DECLARATIONS_LOADING })

  return superagent
    .get('/api/declarations')
    .then((res) =>
      dispatch({ type: FETCH_DECLARATIONS_SUCCESS, payload: res.body }),
    )
    .catch((err) => {
      dispatch({ type: FETCH_DECLARATIONS_FAILURE, payload: err })
      window.Raven.captureException(err)
    })
}

const getUploadErrorMessage = (err) =>
  err.status === 413
    ? `Erreur : Fichier trop lourd (limite : 5000ko) ou dépassant la taille autorisée : ${MAX_PDF_PAGE} pages`
    : err.status === 400
    ? 'Fichier invalide (accepté : .png, .jpg, .pdf)'
    : `Désolé, une erreur s'est produite, Merci de réessayer ultérieurement`

export const uploadEmployerFile = ({
  documentId,
  employerId,
  employerDocType,
  isAddingFile,
  skip,
  file,
}) => (dispatch, getState) => {
  dispatch({
    type: POST_EMPLOYER_DOC_LOADING,
    payload: { documentId, employerId, employerDocType },
  })

  let url = '/api/employers/files'
  if (isAddingFile) url = url.concat('?add=true')

  let request = superagent
    .post(url)
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .field('employerId', employerId)
    .field('documentType', employerDocType)

  if (documentId) {
    request = request.field('id', documentId)
  }
  if (skip) {
    request = request.field('skip', true)
  } else {
    request = request.attach('document', file)
  }

  return request
    .then((res) => {
      dispatch({ type: FETCH_EMPLOYER_SUCCESS, payload: res.body })
      const employer = findEmployer({
        declarations: getState().declarationsReducer.declarations,
        employerId,
      })
      const employerDoc = employer.documents.find(
        (doc) => doc.type === employerDocType,
      )
      if (canUsePDFViewer(employerDoc.file)) {
        dispatch({
          type: SHOW_EMPLOYER_FILE_PREVIEW,
          payload: employerDoc.id,
        })
      }
    })
    .catch((err) => {
      dispatch({
        type: POST_EMPLOYER_DOC_FAILURE,
        payload: {
          err: getUploadErrorMessage(err),
          documentId,
          employerId,
          employerDocType,
        },
      })
      window.Raven.captureException(err)
    })
}

export const uploadDeclarationInfoFile = ({
  documentId,
  file,
  skip,
  isAddingFile,
}) => (dispatch, getState) => {
  dispatch({ type: POST_DECLARATION_INFO_LOADING, payload: { documentId } })

  let url = '/api/declarations/files'
  if (isAddingFile) url = url.concat('?add=true')

  let request = superagent
    .post(url)
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .field('declarationInfoId', documentId)

  if (skip) {
    request = request.field('skip', true)
  } else {
    request = request.attach('document', file)
  }

  return request
    .then((res) => {
      dispatch({ type: FETCH_DECLARATION_SUCCESS, payload: res.body })

      const info = findDeclarationInfo({
        declarations: getState().declarationsReducer.declarations,
        documentId,
      })
      if (canUsePDFViewer(info.file)) {
        dispatch({
          type: SHOW_INFO_FILE_PREVIEW,
          payload: info.id,
        })
      }
    })
    .catch((err) => {
      dispatch({
        type: POST_DECLARATION_INFO_FAILURE,
        payload: { err: getUploadErrorMessage(err), documentId },
      })
      window.Raven.captureException(err)
    })
}

export const removeEmployerFilePage = ({
  documentId,
  employerId,
  employerDocType,
  pageNumberToRemove,
}) => (dispatch, getState) => {
  dispatch({
    type: POST_EMPLOYER_DOC_LOADING,
    payload: { documentId, employerId, employerDocType },
  })

  return superagent
    .post(
      `/api/employers/remove-file-page?pageNumberToRemove=${pageNumberToRemove}`,
    )
    .set('Content-Type', 'application/json')
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .send({ employerId })
    .send({ documentType: employerDocType })
    .then((res) =>
      dispatch({ type: FETCH_EMPLOYER_SUCCESS, payload: res.body }),
    )
    .catch((err) => {
      dispatch({
        type: POST_EMPLOYER_DOC_FAILURE,
        payload: {
          err:
            'Erreur lors de la suppression de la page. Merci de bien vouloir réessayer ultérieurement',
          documentId,
          employerId,
          employerDocType,
        },
      })
      window.Raven.captureException(err)
    })
}

export const removeDeclarationInfoFilePage = ({
  documentId,
  pageNumberToRemove,
}) => (dispatch, getState) => {
  dispatch({ type: POST_DECLARATION_INFO_LOADING, payload: { documentId } })

  return superagent
    .post(
      `/api/declarations/remove-file-page?pageNumberToRemove=${pageNumberToRemove}`,
    )
    .set('Content-Type', 'application/json')
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .send({ declarationInfoId: documentId })
    .then((res) =>
      dispatch({
        type: FETCH_DECLARATION_SUCCESS,
        payload: res.body,
      }),
    )
    .catch((err) => {
      dispatch({
        type: POST_DECLARATION_INFO_FAILURE,
        payload: {
          err:
            'Erreur lors de la suppression de la page. Merci de bien vouloir réessayer ultérieurement',
          documentId,
        },
      })
      window.Raven.captureException(err)
    })
}

export const showEmployerFilePreview = (id) => ({
  type: SHOW_EMPLOYER_FILE_PREVIEW,
  payload: id,
})
export const showInfoFilePreview = (id) => ({
  type: SHOW_INFO_FILE_PREVIEW,
  payload: id,
})

export const hideEmployerFilePreview = () => ({
  type: HIDE_EMPLOYER_FILE_PREVIEW,
})
export const hideInfoFilePreview = () => ({
  type: HIDE_INFO_FILE_PREVIEW,
})

export const fetchActiveDeclaration = () => (dispatch) => {
  dispatch({ type: FETCH_ACTIVE_DECLARATION_LOADING })

  return superagent
    .get('/api/declarations?active')
    .then((res) =>
      dispatch({
        type: FETCH_ACTIVE_DECLARATION_SUCCESS,
        payload: res.body,
      }),
    )
    .catch((err) => {
      // 404 are the normal status when no declaration was made.
      if (err.status !== 404) {
        return dispatch({
          type: FETCH_ACTIVE_DECLARATION_FAILURE,
          payload: err,
        })
      }
      return dispatch({
        type: FETCH_ACTIVE_DECLARATION_SUCCESS,
        payload: null,
      })
    })
}

export const validateEmployerDoc = ({
  documentId,
  employerId,
  employerDocType,
}) => (dispatch, getState) => {
  dispatch({
    type: POST_EMPLOYER_DOC_LOADING,
    payload: { documentId, employerId, employerDocType },
  })

  return superagent
    .post(`/api/employers/files/validate`)
    .set('Content-Type', 'application/json')
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .send({ id: documentId })
    .send({ documentType: employerDocType })
    .then((res) => {
      dispatch({ type: FETCH_EMPLOYER_SUCCESS, payload: res.body })
      dispatch(hideEmployerFilePreview())
    })
    .catch((err) => {
      dispatch({
        type: POST_EMPLOYER_DOC_FAILURE,
        payload: {
          err:
            'Erreur lors de la validation du justificatif, merci de bien vouloir réessayer ultérieurement',
          documentId,
          employerId,
          employerDocType,
        },
      })
      if (err.status === 401 || err.status === 403) {
        return dispatch({ type: SET_USER_LOGGED_OUT })
      }
      window.Raven.captureException(err)
    })
}
export const validateDeclarationInfoDoc = ({ documentId }) => (
  dispatch,
  getState,
) => {
  dispatch({ type: POST_DECLARATION_INFO_LOADING, payload: { documentId } })

  return superagent
    .post(`/api/declarations/files/validate`)
    .set('Content-Type', 'application/json')
    .set('CSRF-Token', getState().userReducer.user.csrfToken)
    .send({ id: documentId })
    .then((res) => {
      dispatch({ type: FETCH_DECLARATION_SUCCESS, payload: res.body })
      dispatch(hideInfoFilePreview())
    })
    .catch((err) => {
      dispatch({
        type: POST_DECLARATION_INFO_FAILURE,
        payload: {
          err:
            'Erreur lors de la validation du justificatif, merci de bien vouloir réessayer ultérieurement',
          documentId,
        },
      })
      if (err.status === 401 || err.status === 403) {
        return dispatch({ type: SET_USER_LOGGED_OUT })
      }
      window.Raven.captureException(err)
    })
}
