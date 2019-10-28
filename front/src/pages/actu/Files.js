import CircularProgress from '@material-ui/core/CircularProgress'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import Typography from '@material-ui/core/Typography'
import withWidth from '@material-ui/core/withWidth'
import CheckCircle from '@material-ui/icons/CheckCircle'
import { capitalize, get, noop, sortBy } from 'lodash'
import moment from 'moment'
import PropTypes from 'prop-types'
import React, { Component, Fragment } from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'

import {
  fetchDeclarations as fetchDeclarationAction,
  hideEmployerFilePreview as hideEmployerFilePreviewAction,
  hideInfoFilePreview as hideInfoFilePreviewAction,
  removeDeclarationInfoFilePage as removeDeclarationInfoFilePageAction,
  removeEmployerFilePage as removeEmployerFilePageAction,
  showEmployerFilePreview as showEmployerFilePreviewAction,
  showInfoFilePreview as showInfoFilePreviewAction,
  uploadDeclarationInfoFile as uploadDeclarationInfoFileAction,
  uploadEmployerFile as uploadEmployerFileAction,
  validateDeclarationInfoDoc as validateDeclarationInfoDocAction,
  validateEmployerDoc as validateEmployerDocAction,
} from '../../redux/actions/declarations'
import DocumentUpload from '../../components/Actu/DocumentUpload'
import FileTransmittedToPE from '../../components/Actu/FileTransmittedToPEDialog'
import LoginAgainDialog from '../../components/Actu/LoginAgainDialog'
import DocumentDialog from '../../components/Generic/documents/DocumentDialog'
import { muiBreakpoints, secondaryBlue } from '../../constants'
import { formattedDeclarationMonth } from '../../lib/date'
import {
  selectPreviewedEmployerDoc,
  selectPreviewedInfoDoc,
  utils,
} from '../../selectors/declarations'

const { getEmployerLoadingKey, getEmployerErrorKey } = utils

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

const FilesSection = styled.section`
  max-width: 88rem;
  width: 100%;
  margin: auto;
  padding-bottom: 4rem;

  &:not(:first-child) {
    padding-top: 4rem;
  }
  &:not(:last-child) {
    border-bottom: 1px solid black;
  }
`

const FilesDoneSection = styled(FilesSection)`
  display: flex;
  justify-content: center;
`

const StyledUl = styled.ul`
  && {
    padding: 0;
  }
`

const DocumentsGroup = styled.div`
  padding-top: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
`

const StyledSup = styled.sup`
  background-color: #ff6237;
  border-radius: 50%;
  width: 1.8rem;
  height: 1.8rem;
  display: inline-block;
  color: #fff;
`

const infoSpecs = [
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

const salarySheetType = 'salarySheet'
const employerCertificateType = 'employerCertificate'
const infoType = 'info'

const OLD_MONTHS_TAB = 'oldMonths'
const LAST_MONTH_TAB = 'lastMonth'

const getDeclarationMissingFilesNb = (declaration) => {
  const infoDocumentsRequiredNb = declaration.infos.filter(
    ({ type, isTransmitted }) => type !== 'jobSearch' && !isTransmitted,
  ).length

  return (
    declaration.employers.reduce((prev, employer) => {
      if (!employer.hasEndedThisMonth) {
        return prev + (get(employer, 'documents[0].isTransmitted') ? 0 : 1)
      }

      /*
          The salary sheet is optional for users which have already sent their employer certificate,
          in which case we do not count it in the needed documents.
        */
      const hasEmployerCertificate = employer.documents.some(
        ({ type, isTransmitted }) =>
          type === employerCertificateType && isTransmitted,
      )
      const hasSalarySheet = employer.documents.some(
        ({ type, isTransmitted }) => type === salarySheetType && isTransmitted,
      )

      if (hasEmployerCertificate) return prev + 0
      return prev + (hasSalarySheet ? 1 : 2)
    }, 0) + infoDocumentsRequiredNb
  )
}

const formatDate = (date) => moment(date).format('DD MMMM YYYY')
const formatInfoDates = ({ startDate, endDate }) =>
  !endDate
    ? `À partir du ${formatDate(startDate)}`
    : `Du ${formatDate(startDate)} au ${formatDate(endDate)}`

// FIXME is this a duplicate with DocumentUpload.types ?
const employerType = 'employer'
const infosType = 'info'
const computeDocUrl = ({ id, type, file }) => {
  // Note: if employer file is missing, there is no data, so we have to check that the id exists
  // But for infosType, the id exists
  if (type === employerType && !id) return null
  if (type === infosType && !!file) return null

  return type === employerType
    ? `/api/employers/files?documentId=${id}`
    : `/api/declarations/files?declarationInfoId=${id}`
}

export class Files extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
      replace: PropTypes.func.isRequired,
    }).isRequired,
    token: PropTypes.string.isRequired,
    declarations: PropTypes.arrayOf(PropTypes.object),
    fetchDeclarations: PropTypes.func.isRequired,
    removeDeclarationInfoFilePage: PropTypes.func.isRequired,
    removeEmployerFilePage: PropTypes.func.isRequired,
    uploadEmployerFile: PropTypes.func.isRequired,
    uploadDeclarationInfoFile: PropTypes.func.isRequired,
    hideEmployerFilePreview: PropTypes.func.isRequired,
    hideInfoFilePreview: PropTypes.func.isRequired,
    previewedEmployerDoc: PropTypes.object,
    previewedInfoDoc: PropTypes.object,
    showInfoFilePreview: PropTypes.func.isRequired,
    showEmployerFilePreview: PropTypes.func.isRequired,
    validateEmployerDoc: PropTypes.func.isRequired,
    validateDeclarationInfoDoc: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
    isUserLoggedOut: PropTypes.bool.isRequired,
    width: PropTypes.string,
  }

  state = {
    showSkipConfirmation: false,
    skipFileCallback: noop,
    selectedTab: LAST_MONTH_TAB,
  }

  componentDidMount() {
    this.props.fetchDeclarations()
  }

  componentDidUpdate(prevProps) {
    // Redirect to /thanks if last declaration's last file was just validated
    const prevDeclaration = prevProps.declarations[0]
    const updatedDeclaration = this.props.declarations[0]

    if (!prevDeclaration || !updatedDeclaration) return
    const missingFilesOnPrevDeclaration = getDeclarationMissingFilesNb(
      prevDeclaration,
    )
    const missingFilesOnUpdatedDeclaration = getDeclarationMissingFilesNb(
      updatedDeclaration,
    )

    if (
      missingFilesOnPrevDeclaration > 0 &&
      missingFilesOnUpdatedDeclaration === 0
    ) {
      return this.props.history.push('/thanks')
    }
  }

  removePage = (data) =>
    data.type === infoType
      ? this.props.removeDeclarationInfoFilePage(data)
      : this.props.removeEmployerFilePage(data)

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

  selectTab = (event, selectedTab) => this.setState({ selectedTab })

  renderDocumentList = (declaration) => {
    const neededAdditionalDocumentsSpecs = infoSpecs.filter(
      (spec) => !!declaration[spec.fieldToCheck],
    )

    const sortedEmployers = sortBy(declaration.employers, 'name')

    const infoDocumentsNodes = neededAdditionalDocumentsSpecs.map(
      (neededDocumentSpecs) => (
        <DocumentsGroup key={neededDocumentSpecs.name}>
          <Typography
            variant="subtitle1"
            style={{ textTransform: 'uppercase' }}
          >
            <b>{neededDocumentSpecs.sectionLabel}</b>
          </Typography>
          <StyledUl>
            {this.renderDocumentsOfType({
              label: neededDocumentSpecs.label,
              name: neededDocumentSpecs.name,
              multiple: neededDocumentSpecs.multiple,
              declaration,
              allowSkipFile: true,
            })}
          </StyledUl>
        </DocumentsGroup>
      ),
    )

    // do not display a section if there are no documents to display.
    if (sortedEmployers.length + infoDocumentsNodes.length === 0) return null

    return (
      <div>
        {sortedEmployers.map((employer, index) => (
          <DocumentsGroup key={employer.id}>
            <Typography
              variant="subtitle1"
              style={{ textTransform: 'uppercase' }}
            >
              <b>Employeur&nbsp;: {employer.employerName}</b>
            </Typography>
            <StyledUl>
              {this.renderEmployerRow({
                employer,
                declaration,
                allowSkipFile: true,
                showTooltip: index === 0,
              })}
            </StyledUl>
          </DocumentsGroup>
        ))}

        <div>{infoDocumentsNodes}</div>
      </div>
    )
  }

  renderDocumentsOfType = ({ label, name, declaration, allowSkipFile }) =>
    declaration.infos
      .filter(({ type }) => type === name)
      .map((info) => (
        <DocumentUpload
          key={`${name}-${info.id}`}
          id={info.id}
          type={DocumentUpload.types.info}
          label={label}
          caption={formatInfoDates(info)}
          fileExistsOnServer={!!info.file && !info.isCleanedUp}
          submitFile={this.props.uploadDeclarationInfoFile}
          removePageFromFile={this.removePageFromFile}
          showPreview={this.props.showInfoFilePreview}
          skipFile={(params) =>
            this.askToSkipFile(() => {
              this.props.uploadDeclarationInfoFile({ ...params, skip: true })
              this.closeSkipModal()
            })
          }
          originalFileName={info.originalFileName}
          allowSkipFile={allowSkipFile}
          isTransmitted={info.isTransmitted}
          declarationInfoId={info.id}
          isLoading={info.isLoading}
          error={info.error}
          useLightVersion={muiBreakpoints.xs === this.props.width}
        />
      ))

  renderEmployerRow = ({
    declaration,
    employer,
    allowSkipFile,
    showTooltip,
  }) => {
    const salaryDoc = employer.documents.find(
      ({ type }) => type === salarySheetType,
    )
    const certificateDoc = employer.documents.find(
      ({ type }) => type === employerCertificateType,
    )

    const commonProps = {
      type: DocumentUpload.types.employer,
      submitFile: this.props.uploadEmployerFile,
      showTooltip,
      skipFile: (params) =>
        this.askToSkipFile(() => {
          this.props.uploadEmployerFile({ ...params, skip: true })
          this.closeSkipModal()
        }),
      allowSkipFile,
      employerId: employer.id,
      showPreview: this.props.showEmployerFilePreview,
      caption: capitalize(
        formattedDeclarationMonth(declaration.declarationMonth.month),
      ),
      useLightVersion: muiBreakpoints.xs === this.props.width,
    }

    const salarySheetUpload = (
      <DocumentUpload
        {...commonProps}
        key={`${employer.id}-${salarySheetType}`}
        id={get(salaryDoc, 'id')}
        label="Bulletin de salaire"
        fileExistsOnServer={
          !!get(salaryDoc, 'file') && !get(salaryDoc, 'isCleanedUp')
        }
        removePage={this.removePage}
        isTransmitted={get(salaryDoc, 'isTransmitted')}
        employerDocType={salarySheetType}
        isLoading={employer[getEmployerLoadingKey(salarySheetType)]}
        error={employer[getEmployerErrorKey(salarySheetType)]}
      />
    )

    if (!employer.hasEndedThisMonth) return salarySheetUpload

    const certificateUpload = (
      <DocumentUpload
        {...commonProps}
        key={`${employer.id}-${employerCertificateType}`}
        id={get(certificateDoc, 'id')}
        label="Attestation employeur"
        fileExistsOnServer={
          !!get(certificateDoc, 'file') && !get(certificateDoc, 'isCleanedUp')
        }
        removePage={this.removePage}
        isTransmitted={get(certificateDoc, 'isTransmitted')}
        employerDocType={employerCertificateType}
        isLoading={employer[getEmployerLoadingKey(employerCertificateType)]}
        error={employer[getEmployerErrorKey(employerCertificateType)]}
      />
    )

    return (
      <Fragment>
        {certificateUpload}
        {certificateDoc && !salaryDoc ? (
          <Typography variant="caption">
            <span
              aria-hidden
              style={{ display: 'inline-block', paddingRight: '0.5rem' }}
            >
              👍
            </span>
            Nous n'avons pas besoin de votre bulletin de salaire pour cet
            employeur, car vous nous avez déjà transmis votre attestation
          </Typography>
        ) : (
          salarySheetUpload
        )}
      </Fragment>
    )
  }

  renderSection = (declaration) => {
    const declarationRemainingDocsNb = getDeclarationMissingFilesNb(declaration)

    const formattedMonth = formattedDeclarationMonth(
      declaration.declarationMonth.month,
    )

    // FIXME : if declarationRemainingDocsNb === 9, isFinished should be true
    // however as sending employers does not for now refresh the whole declaration
    // the object in the store main not be updated.
    // This should be changed as the next look for this page is implemented.
    if (declaration.isFinished || declarationRemainingDocsNb === 0) {
      return (
        <FilesDoneSection key={declaration.id}>
          <Typography>Justificatifs de {formattedMonth} transmis</Typography>
          {' '}
          <CheckCircle />
        </FilesDoneSection>
      )
    }

    return (
      <FilesSection key={declaration.id}>
        <StyledTitle variant="h6" component="h1">
          Justificatifs de {formattedMonth}
        </StyledTitle>
        <StyledInfo>
          <Typography
            style={{
              color: secondaryBlue,
              paddingBottom: '2rem',
            }}
          >
            Vous devez encore valider {declarationRemainingDocsNb} justificatif
            {declarationRemainingDocsNb > 1 ? 's' : ''}
          </Typography>
        </StyledInfo>
        {this.renderDocumentList(declaration)}
      </FilesSection>
    )
  }

  render() {
    const {
      declarations: allDeclarations,
      isLoading,
      previewedEmployerDoc,
      previewedInfoDoc,
      hideEmployerFilePreview,
      hideInfoFilePreview,
      uploadEmployerFile,
      uploadDeclarationInfoFile,
      removeEmployerFilePage,
      removeDeclarationInfoFilePage,
      validateEmployerDoc,
      validateDeclarationInfoDoc,
    } = this.props

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
    const declarations = allDeclarations.filter(
      ({ hasFinishedDeclaringEmployers }) => hasFinishedDeclaringEmployers,
    )

    const [lastDeclaration, ...oldDeclarations] = declarations

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

    const lastDeclarationMissingFiles = getDeclarationMissingFilesNb(
      lastDeclaration,
    )
    const oldDeclarationsMissingFiles = oldDeclarations.reduce(
      (prev, declaration) => {
        if (
          !declaration.hasFinishedDeclaringEmployers ||
          declaration.isFinished
        ) {
          return prev
        }
        return prev + getDeclarationMissingFilesNb(declaration)
      },
      0,
    )

    const showEmployerPreview = !!get(previewedEmployerDoc, 'file')
    const showInfoDocPreview = !!get(previewedInfoDoc, 'file')

    let previewProps = {}

    if (showEmployerPreview) {
      previewProps = {
        onCancel: hideEmployerFilePreview,
        submitFile: uploadEmployerFile,
        removePage: removeEmployerFilePage,
        validateDoc: validateEmployerDoc,
        url: computeDocUrl({ id: previewedEmployerDoc.id, type: employerType }),
        employerDocType: previewedEmployerDoc.type, // renaming it to avoid confusion
        ...previewedEmployerDoc,
      }
    } else if (showInfoDocPreview) {
      previewProps = {
        onCancel: hideInfoFilePreview,
        submitFile: uploadDeclarationInfoFile,
        removePage: removeDeclarationInfoFilePage,
        validateDoc: validateDeclarationInfoDoc,
        url: computeDocUrl({ id: previewedInfoDoc.id, type: infoType }),
        ...previewedInfoDoc,
      }
    }

    return (
      <StyledFiles>
        <Tabs
          value={this.state.selectedTab}
          onChange={this.selectTab}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          style={{ width: '100%' }}
        >
          <Tab
            value={LAST_MONTH_TAB}
            label={
              <div style={{ color: '#000' }}>
                {formattedDeclarationMonth(
                  lastDeclaration.declarationMonth.month,
                )}{' '}
                <StyledSup>{lastDeclarationMissingFiles}</StyledSup>
              </div>
            }
          />
          <Tab
            style={{ color: '#000' }}
            value={OLD_MONTHS_TAB}
            label={
              <div style={{ color: '#000' }}>
                Mois précédents{' '}
                <StyledSup>{oldDeclarationsMissingFiles}</StyledSup>
              </div>
            }
          />
        </Tabs>

        {this.state.selectedTab === LAST_MONTH_TAB &&
          (lastDeclaration.isFinished ? (
            <StyledTitle variant="h6" component="h1">
              Vous avez terminé l'envoi des justificatifs du mois de{' '}
              {formattedDeclarationMonth(
                lastDeclaration.declarationMonth.month,
              )}
            </StyledTitle>
          ) : (
            this.renderSection(lastDeclaration)
          ))}

        {this.state.selectedTab === OLD_MONTHS_TAB &&
          (oldDeclarations.length > 0 ? (
            oldDeclarations.map(this.renderSection)
          ) : (
            <FilesSection>
              <StyledTitle variant="h6" component="h1">
                Pas d'anciens justificatifs disponibles
              </StyledTitle>
            </FilesSection>
          ))}

        <LoginAgainDialog isOpened={this.props.isUserLoggedOut} />
        <FileTransmittedToPE
          isOpened={this.state.showSkipConfirmation}
          onCancel={this.closeSkipModal}
          onConfirm={this.state.skipFileCallback}
        />
        {(showEmployerPreview || showInfoDocPreview) && (
          <DocumentDialog isOpened {...previewProps} />
        )}
      </StyledFiles>
    )
  }
}

export default connect(
  (state) => ({
    declarations: state.declarationsReducer.declarations,
    isLoading: state.declarationsReducer.isLoading,
    previewedEmployerDoc: selectPreviewedEmployerDoc(state),
    previewedInfoDoc: selectPreviewedInfoDoc(state),
    isUserLoggedOut: !!(
      state.userReducer.user && state.userReducer.user.isLoggedOut
    ),
  }),
  {
    fetchDeclarations: fetchDeclarationAction,
    uploadEmployerFile: uploadEmployerFileAction,
    uploadDeclarationInfoFile: uploadDeclarationInfoFileAction,
    removeEmployerFilePage: removeEmployerFilePageAction,
    removeDeclarationInfoFilePage: removeDeclarationInfoFilePageAction,
    showEmployerFilePreview: showEmployerFilePreviewAction,
    showInfoFilePreview: showInfoFilePreviewAction,
    hideEmployerFilePreview: hideEmployerFilePreviewAction,
    hideInfoFilePreview: hideInfoFilePreviewAction,
    validateEmployerDoc: validateEmployerDocAction,
    validateDeclarationInfoDoc: validateDeclarationInfoDocAction,
  },
)(withWidth()(Files))
