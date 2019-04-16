import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import List from '@material-ui/core/List'
import Typography from '@material-ui/core/Typography'
import CheckCircle from '@material-ui/icons/CheckCircle'
import { cloneDeep, get, noop, sortBy } from 'lodash'
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { withRouter } from 'react-router'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import superagent from 'superagent'
import moment from 'moment'

import AdditionalDocumentUpload from '../../components/Actu/AdditionalDocumentUpload'
import EmployerDocumentUpload from '../../components/Actu/EmployerDocumentUpload'
import FilesDialog from '../../components/Actu/FilesDialog'
import FileTransmittedToPE from '../../components/Actu/FileTransmittedToPEDialog'
import LoginAgainDialog from '../../components/Actu/LoginAgainDialog'
import WorkSummary from '../../components/Actu/WorkSummary'
import MainActionButton from '../../components/Generic/MainActionButton'
import { formattedDeclarationMonth } from '../../lib/date'

const StyledFiles = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 88rem;
  width: 100%;
  margin: auto;
  padding-bottom: 2rem;
`

const StyledTitle = styled(Typography)`
  && {
    margin-bottom: 1.5rem;
    text-align: center;
  }
`

const StyledInfo = styled.div`
  text-align: center;
`

const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
  width: 100%;
  padding-top: 2.5rem;
  text-align: center;
  max-width: 40rem;
  margin: 0 auto;
`

const ErrorMessage = styled(Typography)`
  && {
    color: red;
    text-align: center;
    padding-top: 1.5rem;
  }
`

const OtherDocumentsContainer = styled.div`
  background-color: #f2f2f2;
  text-align: center;

  /* Overflowing background*/
  padding: 1rem;
  width: 100vw;
`

const FilesSection = styled.section`
  max-width: 88rem;
  width: 100%;
  margin: auto;
  padding-bottom: 4rem;
`

const FilesDoneSection = styled(FilesSection)`
  display: flex;
  justify-content: center;
`

const StyledList = styled(List)`
  && {
    padding-bottom: 2rem;
  }
`

const DECLARATION_SUBMIT_ERROR_NAME = 'DECLARATION'

const additionalDocumentsSpecs = [
  {
    name: 'sickLeave',
    fieldToCheck: 'hasSickLeave',
    label: 'Feuille maladie',
    sectionLabel: 'Congé maladie',
    dateFields: ['startDate', 'endDate'],
    multiple: true,
  },
  {
    name: 'internship',
    fieldToCheck: 'hasInternship',
    label: 'Attestation de stage',
    sectionLabel: 'Stage',
    dateFields: ['startDate', 'endDate'],
    multiple: true,
  },
  {
    name: 'maternityLeave',
    fieldToCheck: 'hasMaternityLeave',
    label: 'Attestation de congé maternité',
    sectionLabel: 'Congé maternité',
    dateFields: ['startDate'],
  },
  {
    name: 'retirement',
    fieldToCheck: 'hasRetirement',
    label: 'Attestation retraite',
    sectionLabel: 'Retraite',
    dateFields: ['startDate'],
  },
  {
    name: 'invalidity',
    fieldToCheck: 'hasInvalidity',
    label: 'Attestation invalidité',
    sectionLabel: 'Invalidité',
    dateFields: ['startDate'],
  },
]

const getLoadingKey = ({ id, name, declarationId, index = 0 }) =>
  id ? `isLoading-${id}` : `$isLoading-${declarationId}-${name}-${index}`
const getErrorKey = ({ id, name, declarationId, index = 0 }) =>
  id ? `error-${id}` : `error-${declarationId}-${name}-${index}`

const getDeclarationMissingFilesNb = (declaration) => {
  const additionalDocumentsRequiredNb = declaration.infos.filter(
    ({ type, file }) => type !== 'jobSearch' && !file,
  ).length

  // TODO only handles 1 doc / employer, which will have to change whene multiple
  // docs will be sendable
  return (
    declaration.employers.reduce(
      (prev, employer) => prev + (employer.documents[0] ? 0 : 1),
      0,
    ) + additionalDocumentsRequiredNb
  )
}

const formatDate = (date) => moment(date).format('DD MMMM YYYY')

export class Files extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
    token: PropTypes.string.isRequired,
  }

  state = {
    isLoading: true,
    error: null,
    showMissingDocs: false,
    declarations: [],
    isSendingFiles: false,
    showSkipConfirmation: false,
    skipFileCallback: noop,
    isLoggedOut: false,
  }

  componentDidMount() {
    this.fetchDeclarations()
  }

  fetchDeclarations = () => {
    this.setState({ isLoading: true })
    superagent
      .get('/api/declarations')
      .then((res) => res.body)
      .then((declarations) =>
        this.setState({
          declarations,
          isLoading: false,
        }),
      )
  }

  displayMissingDocs = () => this.setState({ showMissingDocs: true })

  submitEmployerFile = ({ declarationId, file, employerId, skip }) => {
    this.closeSkipModal()

    const updateEmployer = ({
      declarationId: dId,
      employerId: eId,
      ...dataToSet
    }) =>
      this.setState((prevState) => {
        const declarations = cloneDeep(prevState.declarations)
        const declarationIndex = this.state.declarations.findIndex(
          ({ id }) => id === dId,
        )
        declarations[declarationIndex].employers = declarations[
          declarationIndex
        ].employers.map((employer) =>
          employer.id === eId ? { ...employer, ...dataToSet } : employer,
        )

        return { declarations }
      })

    updateEmployer({ declarationId, employerId, isLoading: true })

    let request = superagent
      .post('/api/employers/files')
      .set('CSRF-Token', this.props.token)
      .field('employerId', employerId)

    if (skip) {
      request = request.field('skip', true)
    } else {
      request = request.attach('document', file)
    }

    return request
      .then((res) => res.body)
      .then((updatedEmployer) =>
        updateEmployer({
          declarationId,
          employerId: updatedEmployer.id,
          isLoading: false,
          error: null,
          ...updatedEmployer,
        }),
      )
      .catch((err) => {
        const errorLabel =
          err.status === 413
            ? 'Erreur : Fichier trop lourd (limite : 5000ko)'
            : err.status === 400
            ? 'Erreur : Fichier invalide (accepté : .png, .jpg, .pdf, .doc, .docx)'
            : `Désolé, une erreur s'est produite, Merci de réessayer ultérieurement`
        // TODO this should be refined to not send all common errors
        // (file too big, etc)
        window.Raven.captureException(err)
        updateEmployer({
          declarationId,
          employerId,
          isLoading: false,
          error: errorLabel,
        })
      })
  }

  submitAdditionalFile = ({ declarationInfoId, file, skip }) => {
    this.closeSkipModal()

    const errorKey = getErrorKey({
      id: declarationInfoId,
    })
    const loadingKey = getLoadingKey({
      id: declarationInfoId,
    })

    this.setState({
      [loadingKey]: true,
    })

    let request = superagent
      .post('/api/declarations/files')
      .set('CSRF-Token', this.props.token)
      .field('declarationInfoId', declarationInfoId)

    if (skip) {
      request = request.field('skip', true)
    } else {
      request = request.attach('document', file)
    }

    return request
      .then((res) => res.body)
      .then((declaration) => {
        return this.setState((prevState) => {
          const declarations = cloneDeep(prevState.declarations)
          const declarationIndex = declarations.findIndex(
            ({ id }) => declaration.id === id,
          )
          declarations[declarationIndex] = declaration

          return {
            declarations,
            [loadingKey]: false,
            [errorKey]: null,
          }
        })
      })
      .catch((err) => {
        const errorLabel =
          err.status === 413
            ? 'Erreur : Fichier trop lourd (limite : 5000ko)'
            : err.status === 400
            ? 'Fichier invalide (accepté : .png, .jpg, .pdf, .doc, .docx)'
            : `Désolé, une erreur s'est produite, Merci de réessayer ultérieurement`
        // TODO this should be refined to not send all common errors
        // (file too big, etc)
        window.Raven.captureException(err)

        this.setState({
          [loadingKey]: false,
          [errorKey]: errorLabel,
        })
      })
  }

  askToSkipFile = (onConfirm) => {
    this.setState({
      showSkipConfirmation: true,
      skipFileCallback: onConfirm,
    })
  }

  closeSkipModal = () =>
    this.setState({
      showSkipConfirmation: false,
      skipFileCallback: noop,
    })

  onSubmit = ({ declaration }) => {
    const isSendingLastDeclaration =
      declaration.id === this.state.declarations[0].id

    this.setState({ isSendingFiles: true })

    return superagent
      .post('/api/declarations/finish', { id: declaration.id })
      .set('CSRF-Token', this.props.token)
      .then(() => {
        this.setState({ isSendingFiles: false })
        if (isSendingLastDeclaration) return this.props.history.push('/thanks')
        this.fetchDeclarations()
      })
      .catch((error) => {
        // Reporting here to get a metric of how much this happens
        window.Raven.captureException(error)

        if (error.status === 401 || error.status === 403) {
          return this.setState({ isLoggedOut: true })
        }

        this.setState({
          [getErrorKey({
            declarationId: declaration.id,
            name: DECLARATION_SUBMIT_ERROR_NAME,
          })]: error,
          isSendingFiles: false,
        })
        this.fetchDeclarations() // fetching declarations again in case something changed (eg. file was transmitted)
      })
  }

  renderDocumentList = ({ declaration, isOldMonth }) => {
    const neededAdditionalDocumentsSpecs = additionalDocumentsSpecs.filter(
      (spec) => !!declaration[spec.fieldToCheck],
    )

    const sortedEmployers = sortBy(declaration.employers, 'name')

    const salaryNodes = sortedEmployers
      .filter((employer) => !employer.hasEndedThisMonth)
      .map((employer) =>
        this.renderEmployerRow({
          employer,
          declaration,
          allowSkipFile: isOldMonth,
        }),
      )

    const certificateNodes = sortedEmployers
      .filter((employer) => employer.hasEndedThisMonth)
      .map((employer) =>
        this.renderEmployerRow({
          employer,
          declaration,
          allowSkipFile: isOldMonth,
        }),
      )

    const additionalDocumentsNodes = neededAdditionalDocumentsSpecs.map(
      (neededDocumentSpecs) => {
        const infos = declaration.infos.filter(
          ({ type }) => type === neededDocumentSpecs.name,
        )

        return (
          <div key={neededDocumentSpecs.name}>
            <Typography
              variant="subtitle1"
              style={{ textTransform: 'uppercase' }}
            >
              <b>{neededDocumentSpecs.sectionLabel}</b>
            </Typography>
            <Typography variant="caption">
              {neededDocumentSpecs.multiple && (
                <ul style={{ paddingLeft: 0 }}>
                  {infos.map(({ startDate, endDate }, key) => (
                    /* eslint-disable-next-line react/no-array-index-key */
                    <li key={key} style={{ display: 'block' }}>
                      Du {formatDate(startDate)} au {formatDate(endDate)}
                    </li>
                  ))}
                </ul>
              )}
              {!neededDocumentSpecs.multiple &&
                (!infos.endDate
                  ? `À partir du ${formatDate(infos.startDate)}`
                  : `Du ${formatDate(infos.startDate)} au ${formatDate(
                      infos.endDate,
                    )}`)}
            </Typography>
            <StyledList>
              {this.renderDocumentsOfType({
                label: neededDocumentSpecs.label,
                name: neededDocumentSpecs.name,
                multiple: neededDocumentSpecs.multiple,
                declaration,
                allowSkipFile: isOldMonth,
              })}
            </StyledList>
          </div>
        )
      },
    )

    // do not display a section if there are no documents to display.
    if (
      salaryNodes.length +
        certificateNodes.length +
        additionalDocumentsNodes.length ===
      0
    )
      return null

    const formattedMonth = formattedDeclarationMonth(
      declaration.declarationMonth.month,
    )

    return (
      <div>
        <div>
          <Typography
            variant="subtitle1"
            style={{ textTransform: 'uppercase' }}
          >
            <b>
              {salaryNodes.length} bulletin{salaryNodes.length > 1 && 's'} de
              salaire
            </b>
          </Typography>
          <Typography variant="caption">
            Salaire pour {formattedMonth}
          </Typography>
          <StyledList>{salaryNodes}</StyledList>
        </div>

        {certificateNodes.length > 0 && (
          <div>
            <Typography
              variant="subtitle1"
              style={{ textTransform: 'uppercase' }}
            >
              <b>
                {certificateNodes.length} contrat
                {certificateNodes.length > 1 && 's'} terminé
                {certificateNodes.length > 1 && 's'}
              </b>
            </Typography>
            <Typography variant="caption">
              Fin de contrat{certificateNodes.length > 1 && 's'} en{' '}
              {formattedMonth}
            </Typography>
            <StyledList>{certificateNodes}</StyledList>
          </div>
        )}

        <div>{additionalDocumentsNodes}</div>
      </div>
    )
  }

  renderOlderDocumentsList = (declaration) =>
    this.renderDocumentList({
      declaration,
      isOldMonth: true,
      allowSkipFile: true,
    })

  renderCurrentDocumentsList = (declaration) =>
    this.renderDocumentList({
      declaration,
      isOldMonth: false,
      allowSkipFile: false,
    })

  renderDocumentsOfType = ({ label, name, declaration, allowSkipFile }) =>
    declaration.infos
      .filter(({ type }) => type === name)
      .map((additionalDoc) => (
        <AdditionalDocumentUpload
          key={`${name}-${additionalDoc.id}`}
          label={label}
          error={
            this.state[
              getErrorKey({
                id: additionalDoc.id,
              })
            ]
          }
          fileExistsOnServer={!!additionalDoc.file}
          isLoading={
            this.state[
              getLoadingKey({
                id: additionalDoc.id,
              })
            ]
          }
          submitFile={this.submitAdditionalFile}
          skipFile={() =>
            this.askToSkipFile(() =>
              this.submitAdditionalFile({
                skip: true,
                declarationInfoId: additionalDoc.id,
              }),
            )
          }
          allowSkipFile={allowSkipFile}
          isTransmitted={additionalDoc.isTransmitted}
          declarationInfoId={additionalDoc.id}
        />
      ))

  renderEmployerRow = ({ employer, declaration, allowSkipFile }) => (
    <EmployerDocumentUpload
      key={employer.id}
      {...employer}
      submitFile={({ file }) =>
        this.submitEmployerFile({
          declarationId: declaration.id,
          employerId: employer.id,
          file,
        })
      }
      skipFile={() =>
        this.askToSkipFile(() =>
          this.submitEmployerFile({
            declarationId: declaration.id,
            skip: true,
            employerId: employer.id,
          }),
        )
      }
      allowSkipFile={allowSkipFile}
      fileExistsOnServer={!!employer.documents[0]}
      isTransmitted={get(employer.documents[0], 'isTransmitted')}
      documentId={get(employer, 'documents[0].id')}
    />
  )

  renderOldSection = (declaration) => this.renderSection(declaration, true)

  renderSection = (declaration, isOldMonth) => {
    const declarationRemainingDocsNb = getDeclarationMissingFilesNb(declaration)

    const error = this.state[
      getErrorKey({
        declarationId: declaration.id,
        name: DECLARATION_SUBMIT_ERROR_NAME,
      })
    ]

    const formattedMonth = formattedDeclarationMonth(
      declaration.declarationMonth.month,
    )

    if (declaration.isFinished) {
      return (
        <FilesDoneSection key={declaration.id}>
          <Typography variant="body1">
            Fichiers de {formattedMonth} transmis
          </Typography>
          {' '}
          <CheckCircle />
        </FilesDoneSection>
      )
    }

    return (
      <FilesSection key={declaration.id}>
        <StyledTitle variant="h6" component="h1">
          Envoi des documents du mois de {formattedMonth}
        </StyledTitle>
        <StyledInfo>
          <Typography
            variant="body1"
            style={{
              color: declarationRemainingDocsNb > 0 ? '#df5555' : '#3e689b',
              paddingBottom: '2rem',
            }}
          >
            {declarationRemainingDocsNb > 0
              ? `Reste ${declarationRemainingDocsNb} documents à fournir`
              : 'Tous vos documents sont prêts à être envoyés'}
          </Typography>
        </StyledInfo>
        {isOldMonth
          ? this.renderOlderDocumentsList(declaration)
          : this.renderCurrentDocumentsList(declaration)}
        <WorkSummary employers={declaration.employers} />
        <StyledInfo>
          <Typography variant="body1">
            Vous pourrez envoyer vos documents à Pôle Emploi une fois qu'ils
            seront tous là.
            <br />
            Cela permettra une meilleure gestion de votre dossier.
          </Typography>
        </StyledInfo>
        {error && (
          <ErrorMessage variant="body1">
            Nous sommes désolés, une erreur s'est produite lors de l'envoi des
            documents. Merci de bien vouloir réessayer.
            <br />
            Si le problème se reproduit, merci de bien vouloir contacter
            l'équipe Zen.
          </ErrorMessage>
        )}
        <ButtonsContainer>
          {!isOldMonth && (
            <MainActionButton
              primary={false}
              component={Link}
              to="/thanks?later"
            >
              Enregistrer
              <br />
              et finir plus tard
            </MainActionButton>
          )}
          <MainActionButton
            disabled={declarationRemainingDocsNb > 0}
            primary
            onClick={() => this.onSubmit({ declaration })}
          >
            Envoyer
            {!isOldMonth && <br />}
            {isOldMonth
              ? `les documents de ${formattedMonth}`
              : 'à Pôle Emploi'}
          </MainActionButton>
        </ButtonsContainer>
      </FilesSection>
    )
  }

  render() {
    const { isLoading } = this.state

    if (isLoading) {
      return (
        <StyledFiles>
          <CircularProgress />
        </StyledFiles>
      )
    }

    // display filter : In the case of old declarations displayed,
    // a declaration which had been abandonned by a user at step 2
    // could theoretically be here if the user came back later.
    // We remove that possibility.
    const declarations = this.state.declarations.filter(
      ({ hasFinishedDeclaringEmployers }) => hasFinishedDeclaringEmployers,
    )

    const lastDeclaration = declarations[0]

    const areUnfinishedDeclarations = declarations
      .slice(1)
      .some(({ isFinished }) => !isFinished)

    if (
      !lastDeclaration ||
      (lastDeclaration.isFinished && !areUnfinishedDeclarations)
    ) {
      // Users have come to this page without any old documents to validate
      return (
        <StyledFiles>
          <StyledTitle variant="h6" component="h1">
            Vous n'avez pas de fichier à envoyer.
          </StyledTitle>
        </StyledFiles>
      )
    }

    return (
      <StyledFiles>
        {lastDeclaration.isFinished ? (
          <StyledTitle variant="h6" component="h1">
            Vous avez terminé l'envoi des documents du mois de{' '}
            {formattedDeclarationMonth(lastDeclaration.declarationMonth.month)}
          </StyledTitle>
        ) : (
          this.renderSection(lastDeclaration)
        )}
        {areUnfinishedDeclarations > 0 && (
          <OtherDocumentsContainer>
            <Typography paragraph>
              Des documents de précédents mois n'ont pas encore été transmis
            </Typography>
            {!this.state.showMissingDocs ? (
              <Button color="primary" onClick={this.displayMissingDocs}>
                Afficher les documents manquants
              </Button>
            ) : (
              declarations.slice(1).map(this.renderOldSection)
            )}
          </OtherDocumentsContainer>
        )}
        <FilesDialog isOpened={this.state.isSendingFiles} />
        <LoginAgainDialog isOpened={this.state.isLoggedOut} />
        <FileTransmittedToPE
          isOpened={this.state.showSkipConfirmation}
          onCancel={this.closeSkipModal}
          onConfirm={this.state.skipFileCallback}
        />
      </StyledFiles>
    )
  }
}

export default withRouter(Files)
