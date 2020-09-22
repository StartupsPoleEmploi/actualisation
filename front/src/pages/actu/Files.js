/* eslint-disable react/jsx-props-no-spreading */
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import withWidth from '@material-ui/core/withWidth';
import { get, noop } from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { withStyles } from '@material-ui/core/styles';
import ArrowDropDown from '@material-ui/icons/ArrowDropDown';
import ArrowDropUp from '@material-ui/icons/ArrowDropUp';
import { Link, Redirect } from 'react-router-dom';

import StatusFilesError from '../../components/Actu/StatusFilesError';
import { H1 } from '../../components/Generic/Titles';

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
} from '../../redux/actions/declarations';
import {
  showSnackbarUpload as showSnackbarUploadAction,
  hideSnackbarUpload as hideSnackbarUploadAction,
} from '../../redux/actions/thanks';
import DocumentUpload from '../../components/Actu/DocumentUpload';
import FileTransmittedToPE from '../../components/Actu/FileTransmittedToPEDialog';
import LoginAgainDialog from '../../components/Actu/LoginAgainDialog';
import DocumentDialog from '../../components/Generic/documents/DocumentDialog';
import { muiBreakpoints, secondaryBlue } from '../../constants';
import { formattedDeclarationMonth } from '../../lib/date';
import { getDeclarationMissingFilesNb } from '../../lib/file';
import {
  selectPreviewedEmployerDoc,
  selectPreviewedInfoDoc,
  utils,
} from '../../selectors/declarations';
import NotAutorized from '../other/NotAutorized';
import ErrorSnackBar from '../../components/Generic/ErrorSnackBar';
import SuccessSnackBar from '../../components/Generic/SuccessSnackBar';

const { findEmployer, getEmployerLoadingKey, getEmployerErrorKey } = utils;

const StyledFiles = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 91rem;
  width: 100%;
  margin: auto;
  padding-bottom: 2rem;
`;

const MonthInfoTitle = styled(Typography)`
  && {
    font-size: 2.5rem;
    text-transform: capitalize;
    font-weight: bold;
    color: ${secondaryBlue};
    flex: 1;
  }
`;

const MonthNumberTitle = styled(MonthInfoTitle)`
  && {
    color: #FF6236;
    font-weight: normal;
    display: inline-block;
  }
`;

const FilesSection = styled.section`
  width: 100%;
  padding-bottom: 1rem;

  &:not(:first-child) {
    padding-top: 3rem;
  }
  &:not(:last-child) {
    border-bottom: ${({ width }) =>
    (width === 'xs' ?
      '2px solid rgba(0, 0, 0, 0.1)' :
      '1px solid rgba(0, 0, 0, 0.1)')};
  }
`;

const StyledUl = styled.ul`
  && {
    padding: 0;
  }
`;

const DocumentsGroup = styled.div`
  padding-top: 3rem;
  padding-bottom: 4rem;
`;

const StyledSup = styled.sup`
  background-color: #ff6237;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2rem;
  margin-left: 1rem;
`;

const H1Title = styled(H1)`
  && {
    font-size: 2.2rem;
    width: 100%;
    max-width: 95rem;
    background-color: #FAFAFA;
    display: flex;
    align-items: center;
    height: 8rem;
    padding-left: 2rem;
    margin: 2rem auto 4rem auto;
  }
`;

const DialogContentTextLabel = styled(Typography)`
  && {
    color: black;
    cursor: pointer;
    &:hover {
      opacity: 0.6;
    }
  }
`;

const CollapsedTitle = styled.div`
  display: flex;
  align-items: center;
  transition: opacity 0.4s;
  margin-bottom: 1rem;
`;

const styles = () => ({
  selected: {
    fontWeight: 'bold',
  },
});

const ArrowDown = styled(ArrowDropDown)`
  color: #0065DB;
`;

const ArrowUp = styled(ArrowDropUp)`
  color: #0065DB;
`;

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
];

const salarySheetType = 'salarySheet';
const employerCertificateType = 'employerCertificate';
const infoType = 'info';

const formatDate = (date) => moment(date).format('DD MMMM YYYY');
const formatInfoDates = ({ startDate, endDate }) =>
  (!endDate ?
    `À partir du ${formatDate(startDate)}` :
    `Du ${formatDate(startDate)} au ${formatDate(endDate)}`);

// FIXME is this a duplicate with DocumentUpload.types ?
const employerType = 'employer';
const infosType = 'info';
const computeDocUrl = ({ id, type, file }) => {
  // Note: if employer file is missing, there is no data, so we have to check that the id exists
  // But for infosType, the id exists
  if (type === employerType && !id) return null;
  if (type === infosType && !!file) return null;

  return type === employerType ?
    `/api/employers/files?documentId=${id}` :
    `/api/declarations/files?declarationInfoId=${id}`;
};

export class Files extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showSkipConfirmation: false,
      skipFileCallback: noop,
      snackError: null,
      snackSuccess: null,
      collapsedMonth: [],
    };
  }

  componentDidMount() {
    this.props.fetchDeclarations();
  }

  componentDidUpdate(prevProps) {
    // Redirect to /thanks if last declaration's last file was just validated
    const prevDeclaration = prevProps.declarations[0];
    const updatedDeclaration = this.props.declarations[0];

    if (!prevDeclaration || !updatedDeclaration) return;
    const missingFilesOnPrevDeclaration = getDeclarationMissingFilesNb(
      prevDeclaration,
    );
    const missingFilesOnUpdatedDeclaration = getDeclarationMissingFilesNb(
      updatedDeclaration,
    );

    if (
      missingFilesOnPrevDeclaration > 0 &&
      missingFilesOnUpdatedDeclaration === 0
    ) {
      return this.props.history.push('/thanks');
    }
  }

  removePage = (data) =>
    (data.type === infoType ?
      this.props.removeDeclarationInfoFilePage(data) :
      this.props.removeEmployerFilePage(data))

  askToSkipFile = (onConfirm) => {
    this.setState({
      showSkipConfirmation: true,
      skipFileCallback: onConfirm,
    });
  }

  closeSkipModal = () =>
    this.setState({
      showSkipConfirmation: false,
      skipFileCallback: noop,
    })

  renderDocumentList = (declaration) => {
    const neededAdditionalDocumentsSpecs = infoSpecs.filter(
      (spec) => !!declaration[spec.fieldToCheck],
    );

    const sortedEmployers = declaration.employers.slice();
    sortedEmployers.sort((emp1, emp2) => {
      const emp1MissingFile = emp1.documents.filter((d) => d.isTransmitted)
        .length;
      const emp2MissingFile = emp2.documents.filter((d) => d.isTransmitted)
        .length;
      return emp1MissingFile - emp2MissingFile;
    });

    const infoDocumentsNodes = neededAdditionalDocumentsSpecs.map(
      (neededDocumentSpecs) => (
        this.renderDocumentsOfType({
          label: neededDocumentSpecs.label,
          name: neededDocumentSpecs.name,
          multiple: neededDocumentSpecs.multiple,
          declaration,
          allowSkipFile: true,
        })
      ),
    );

    // do not display a section if there are no documents to display.
    if (sortedEmployers.length + infoDocumentsNodes.length === 0) return null;

    return (
      <div>
        {sortedEmployers.map((employer, index) => (
          this.renderEmployerRow({
            employer,
            declaration,
            allowSkipFile: true,
            showTooltip: index === 0,
          })
        ))}

        <div>{infoDocumentsNodes}</div>
      </div>
    );
  }

  renderDocumentsOfType = ({
    label, name, declaration, allowSkipFile,
  }) =>
    declaration.infos
      .filter(({ type }) => type === name)
      .map((info) => (info.isTransmitted ? <></> : (
        <DocumentsGroup key={`${name}-${info.id}`} width={this.props.width} className="info-row">
          <StyledUl>
            <DocumentUpload
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
                  this.props.uploadDeclarationInfoFile({ ...params, skip: true });
                  this.closeSkipModal();
                })}
              originalFileName={info.originalFileName}
              allowSkipFile={allowSkipFile}
              isTransmitted={info.isTransmitted}
              declarationInfoId={info.id}
              isLoading={info.isLoading}
              error={info.error}
              useLightVersion={
                muiBreakpoints.xs === this.props.width ||
                muiBreakpoints.sm === this.props.width
              }

            />
          </StyledUl>

        </DocumentsGroup>
      )))

  renderEmployerRow = ({ employer, allowSkipFile, showTooltip }) => {
    const salaryDoc = employer.documents.find(
      ({ type }) => type === salarySheetType,
    );
    const certificateDoc = employer.documents.find(
      ({ type }) => type === employerCertificateType,
    );

    const commonProps = {
      type: DocumentUpload.types.employer,
      submitFile: this.props.uploadEmployerFile,
      showTooltip,
      skipFile: (params) =>
        this.askToSkipFile(() => {
          this.props.uploadEmployerFile({ ...params, skip: true });
          this.closeSkipModal();
        }),
      allowSkipFile,
      employerId: employer.id,
      showPreview: this.props.showEmployerFilePreview,
      useLightVersion:
        muiBreakpoints.xs === this.props.width ||
        muiBreakpoints.sm === this.props.width,
    };

    const isSalaryDocTransmitted = get(salaryDoc, 'isTransmitted');
    const salarySheetUpload = (
      <DocumentUpload
        {...commonProps}
        key={`${employer.id}-${salarySheetType}`}
        id={get(salaryDoc, 'id')}
        label={employer.employerName}
        caption="Bulletin de salaire"
        fileExistsOnServer={
          !!get(salaryDoc, 'file') && !get(salaryDoc, 'isCleanedUp')
        }
        removePage={this.removePage}
        isTransmitted={isSalaryDocTransmitted}
        employerDocType={salarySheetType}
        isLoading={employer[getEmployerLoadingKey(salarySheetType)]}
        error={employer[getEmployerErrorKey(salarySheetType)]}

      />
    );

    if (!employer.hasEndedThisMonth) {
      return isSalaryDocTransmitted ? <></> : (
        <DocumentsGroup key={employer.id} width={this.props.width} className="employer-row">
          <StyledUl>{salarySheetUpload}</StyledUl>
        </DocumentsGroup>
      );
    }

    const isCertificatDocTransmitted = get(certificateDoc, 'isTransmitted');
    const certificateUpload = (
      <DocumentUpload
        {...commonProps}
        key={`${employer.id}-${employerCertificateType}`}
        id={get(certificateDoc, 'id')}
        label={employer.employerName}
        caption="Attestation employeur"
        fileExistsOnServer={
          !!get(certificateDoc, 'file') && !get(certificateDoc, 'isCleanedUp')
        }
        removePage={this.removePage}
        isTransmitted={isCertificatDocTransmitted}
        employerDocType={employerCertificateType}
        isLoading={employer[getEmployerLoadingKey(employerCertificateType)]}
        error={employer[getEmployerErrorKey(employerCertificateType)]}
      />
    );

    return (isCertificatDocTransmitted ||
      (isCertificatDocTransmitted && isSalaryDocTransmitted)) ? <></> : (
        <DocumentsGroup key={employer.id} width={this.props.width} className="employer-row">
          <StyledUl>
            {certificateUpload}
            {certificateDoc && !salaryDoc ? (
              <Typography variant="caption" style={{ fontSize: '1.6rem' }}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    paddingRight: '0.5rem',
                  }}
                >
                  👍
                </span>
                Nous n'avons pas besoin de votre bulletin de salaire pour cet
                employeur, car vous nous avez déjà transmis votre attestation
              </Typography>
            ) : (
              salarySheetUpload
            )}
          </StyledUl>
        </DocumentsGroup>
      );
  }

  onCollapseMonth = (id) => {
    const { collapsedMonth } = this.state;
    const index = collapsedMonth.indexOf(id);

    if (index === -1) {
      collapsedMonth.push(id);
    } else {
      collapsedMonth.splice(index, 1);
    }

    this.setState({ collapsedMonth });
  }

  renderMonth = (declaration) => {
    const formattedMonth = formattedDeclarationMonth(
      declaration.declarationMonth.month,
    );
    const isCollapsed = !(this.state.collapsedMonth.indexOf(declaration.id) === -1);

    return (
      <FilesSection key={declaration.id} width={this.props.width}>
        <CollapsedTitle>
          <MonthInfoTitle variant="h6" component="h2">
            {formattedMonth}
            {' '}
            <MonthNumberTitle>
              (
              {declaration.nbMissingFiles}
              )
            </MonthNumberTitle>
          </MonthInfoTitle>
          <DialogContentTextLabel onClick={() => this.onCollapseMonth(declaration.id)}>{isCollapsed ? 'AFFICHER' : 'MASQUER'}</DialogContentTextLabel>
          {!isCollapsed ?
            <ArrowDown /> :
            <ArrowUp />}
        </CollapsedTitle>
        {!isCollapsed && this.renderDocumentList(declaration)}
      </FilesSection>
    );
  }

  render() {
    const {
      declarations,
      totalMissingFiles,
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
      isFilesServiceUp,
      validateDeclarationInfoDoc,
      hideSnackbarUpload,
      showSnackbarUploadSuccess,
      user,
    } = this.props;

    const {
      snackError,
      snackSuccess,
    } = this.state;

    // declaration with finish declaration / not finished all / missing files and sort by newer
    const allDeclarations = declarations.filter(({ hasFinishedDeclaringEmployers, isFinished }) =>
      hasFinishedDeclaringEmployers && !isFinished)
      .map((d) => ({ ...d, nbMissingFiles: getDeclarationMissingFilesNb(d) }))
      .filter(({ nbMissingFiles }) => nbMissingFiles !== 0);

    if (isLoading) {
      return (
        <StyledFiles>
          <CircularProgress />
        </StyledFiles>
      );
    }

    if (!isFilesServiceUp) {
      return (
        <StyledFiles>
          <StatusFilesError />
        </StyledFiles>
      );
    }

    if (user.isBlocked) {
      return (
        <StyledFiles>
          <NotAutorized />
        </StyledFiles>
      );
    }

    if (declarations.every((d) => d.isFinished)) {
      return <Redirect to="/thanks" />;
    }

    const showEmployerPreview = !!get(previewedEmployerDoc, 'file');
    const showInfoDocPreview = !!get(previewedInfoDoc, 'file');

    let previewProps = {};

    if (showEmployerPreview) {
      previewProps = {
        onCancel: (props) => {
          this.setState({ snackError: 'Un justificatif n\'a pas été validé' });
          return hideEmployerFilePreview(props);
        },
        submitFile: uploadEmployerFile,
        removePage: removeEmployerFilePage,
        validateDoc: (props) => validateEmployerDoc(props).then(() => {
          const employer = findEmployer({
            declarations: allDeclarations,
            employerId: props.employerId,
          });
          if (props.employerDocType === employerCertificateType &&
            employer.documents.length === 1) {
            this.props.showSnackbarUpload();
          } else {
            this.setState({
              snackSuccess: (
                <>
                  Justificatif visible dans votre
                  {' '}
                  <Link to="/history">historique</Link>
                </>
              ),
            });
          }
        }),
        url: computeDocUrl({ id: previewedEmployerDoc.id, type: employerType }),
        employerDocType: previewedEmployerDoc.type, // renaming it to avoid confusion
        ...previewedEmployerDoc,
      };
    } else if (showInfoDocPreview) {
      previewProps = {
        onCancel: (props) => { this.setState({ snackError: 'Un justificatif n\'a pas été validé' }); return hideInfoFilePreview(props); },
        submitFile: uploadDeclarationInfoFile,
        removePage: removeDeclarationInfoFilePage,
        validateDoc: (props) => validateDeclarationInfoDoc(props).then(() => this.setState({
          snackSuccess: (
            <>
              Justificatif visible dans votre
              {' '}
              <Link to="/history">historique</Link>
            </>
          ),
        })),
        url: computeDocUrl({ id: previewedInfoDoc.id, type: infoType }),
        ...previewedInfoDoc,
      };
    }

    let error = snackError;
    if (!error) {
      // fetch if document have an error
      declarations.map((declaration) => {
        if ((declaration.employers || []).some((d) => d.salarySheetError) ||
          (declaration.infos || []).some((d) => d.error)) {
          error = 'Un problème est survenu veuillez réessayer plus tard';
        }

        return declaration;
      });
    }

    return (
      <>
        <H1Title className="declaration-title">
          {totalMissingFiles > 1 ? 'JUSTIFICATIFS MANQUANTS' : 'JUSTIFICATIF MANQUANT'}
          {' '}
          <StyledSup>{totalMissingFiles}</StyledSup>
        </H1Title>

        <StyledFiles>
          {allDeclarations.map(this.renderMonth.bind(this))}
        </StyledFiles>

        <LoginAgainDialog isOpened={this.props.isUserLoggedOut} />
        <FileTransmittedToPE
          isOpened={this.state.showSkipConfirmation}
          onCancel={this.closeSkipModal}
          onConfirm={this.state.skipFileCallback}
        />
        {(showEmployerPreview || showInfoDocPreview) && (
          <DocumentDialog isOpened {...previewProps} />
        )}

        {showSnackbarUploadSuccess && (
          <SuccessSnackBar
            message={"Nous n'avons pas besoin de votre bulletin de salaire pour cet employeur car vous venez de nous transmettre l'attestation employeur."}
            onHide={() => {
              hideSnackbarUpload();
              this.setState({ snackSuccess: 'Justificatif envoyé disponible dans l\'historique' });
            }}
            closeIcon
            duraction={null}
          />
        )}
        {snackSuccess && (
          <SuccessSnackBar
            message={snackSuccess}
            onHide={() => this.setState({ snackSuccess: null })}
            closeIcon
            duraction={null}
          />
        )}
        {error && <ErrorSnackBar message={error} closeIcon duraction={null} />}
      </>
    );
  }
}

Files.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
    replace: PropTypes.func.isRequired,
  }).isRequired,
  user: PropTypes.object.isRequired,
  totalMissingFiles: PropTypes.number,
  declarations: PropTypes.arrayOf(PropTypes.object),
  collapsedMonth: PropTypes.arrayOf(PropTypes.number),
  fetchDeclarations: PropTypes.func.isRequired,
  showSnackbarUpload: PropTypes.func.isRequired,
  hideSnackbarUpload: PropTypes.func.isRequired,
  showSnackbarUploadSuccess: PropTypes.func.isRequired,
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
  isFilesServiceUp: PropTypes.bool.isRequired,
  width: PropTypes.string,
  snackError: PropTypes.string,
  snackSuccess: PropTypes.object,
};

export default connect(
  (state) => ({
    declarations: state.declarationsReducer.declarations,
    showSnackbarUploadSuccess: state.thanksReducer.showSnackbarUploadSuccess,
    totalMissingFiles: state.declarationsReducer.missingFiles,
    isLoading: state.declarationsReducer.isLoading,
    previewedEmployerDoc: selectPreviewedEmployerDoc(state),
    previewedInfoDoc: selectPreviewedInfoDoc(state),
    isFilesServiceUp: state.statusReducer.isFilesServiceUp,
    user: state.userReducer.user,
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
    showSnackbarUpload: showSnackbarUploadAction,
    hideSnackbarUpload: hideSnackbarUploadAction,
  },
)(withWidth()(withStyles(styles)(Files)));
