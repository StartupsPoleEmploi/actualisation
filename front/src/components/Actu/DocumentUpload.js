import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import FormLabel from '@material-ui/core/FormLabel'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import Autorenew from '@material-ui/icons/Autorenew'
import Check from '@material-ui/icons/Check'
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank'
import Info from '@material-ui/icons/InfoOutlined'
import Eye from '@material-ui/icons/RemoveRedEye'
import Warning from '@material-ui/icons/WarningRounded'
import PropTypes from 'prop-types'
import React, { Component, Fragment } from 'react'
import styled from 'styled-components'

import CustomColorButton from '../Generic/CustomColorButton'

const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
`

const StyledListItem = styled(ListItem)`
  && {
    flex: 1 1 30rem;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
    flex-wrap: wrap;
    border-width: 1px;
    border-style: solid;
    border-left-width: 0.8rem;
    border-radius: 0.5rem;
    margin-top: 1rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 0 0.5rem 0.1rem #eee;
  }
`

const BaseStyledFormLabel = styled(FormLabel)`
  && {
    display: flex;
    background-color: #f5f5f5;
    border-radius: 1rem;
    padding-left: 1rem;
    align-items: center;
  }
`

const StyledFormLabel = styled(BaseStyledFormLabel)`
  justify-content: flex-end;
  width: 26.3rem;
`

const SideFormLabel = styled(BaseStyledFormLabel)`
  && {
    width: 12rem;
    background-color: transparent;
  }
`

const StyledFormHelperText = styled(FormHelperText)`
  && {
    margin: 0 1.5rem;
  }
`

const Container = styled.div`
  display: flex;
  align-items: center;
`

const InfoIcon = styled(Info)`
  margin-left: 0.5rem;
`

const EyeIcon = styled(Eye)`
  margin-right: 2rem;
`

const ErrorTypography = styled(Typography).attrs({ variant: 'caption' })`
  && {
    color: red;
    padding-right: 1rem;
  }
`

const SideButton = styled(Button)`
  & > * {
    flex-direction: column;
    text-transform: uppercase;
    text-align: center;
    font-size: 1.1rem;
  }
`

const employerType = 'employer'
const infosType = 'infos'

export class DocumentUpload extends Component {
  static propTypes = {
    id: PropTypes.number,
    error: PropTypes.string,
    fileExistsOnServer: PropTypes.bool,
    label: PropTypes.string.isRequired,
    caption: PropTypes.string,
    isLoading: PropTypes.bool,
    isTransmitted: PropTypes.bool,
    submitFile: PropTypes.func.isRequired,
    allowSkipFile: PropTypes.bool,
    skipFile: PropTypes.func.isRequired,
    type: PropTypes.oneOf([employerType, infosType]),
    infoTooltipText: PropTypes.string,
    employerId: PropTypes.number,
    employerDocType: PropTypes.string,
  }

  static types = { employer: employerType, infos: infosType }

  submitFile = ({ target: { files } }) =>
    this.props.submitFile({
      file: files[0],
      documentId: this.props.id,
      type: this.props.type,
      employerId: this.props.employerId,
      employerDocType: this.props.employerDocType,
    })

  skipFile = () =>
    this.props.skipFile({
      type: this.props.type,
      documentId: this.props.id,
      employerId: this.props.employerId,
      employerDocType: this.props.employerDocType,
    })

  render() {
    const {
      id,
      caption,
      error,
      fileExistsOnServer,
      isLoading,
      isTransmitted,
      label,
      allowSkipFile,
      type,
      infoTooltipText,
    } = this.props

    const formattedError = <ErrorTypography>{error}</ErrorTypography>

    const hiddenInput = (
      <input
        accept=".png, .jpg, .jpeg, .pdf, .doc, .docx"
        style={{ display: 'none' }}
        type="file"
        onChange={this.submitFile}
      />
    )

    const url =
      type === employerType
        ? `/api/employers/files?documentId=${id}`
        : `/api/declarations/files?declarationInfoId=${id}`

    return (
      <StyledContainer>
        <StyledListItem
          style={{ borderColor: fileExistsOnServer ? '#3e689b' : '#df5555' }}
        >
          <ListItemText
            primary={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div>
                  <b>{label}</b>
                  {caption && (
                    <Fragment>
                      <br />
                      <Typography variant="caption">{caption}</Typography>
                    </Fragment>
                  )}
                </div>
                {infoTooltipText && (
                  <Tooltip
                    title={
                      <Typography style={{ color: '#fff' }}>
                        {infoTooltipText}
                      </Typography>
                    }
                    placement="top"
                    enterDelay={0}
                    leaveDelay={1500}
                    enterTouchDelay={0}
                    leaveTouchDelay={3000}
                  >
                    <InfoIcon />
                  </Tooltip>
                )}
              </div>
            }
          />
          <FormControl>
            {isLoading ? (
              <CircularProgress />
            ) : (
              <Container>
                {error
                  ? formattedError
                  : fileExistsOnServer && (
                      <Button
                        variant="outlined"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          justifyContent: 'space-between',
                          whiteSpace: 'nowrap',
                          height: 32,
                          minHeight: 32,
                          width: 263, // Note: width mirrors value in StyledFormLabel
                        }}
                      >
                        <EyeIcon />
                        Voir le document fourni
                      </Button>
                    )}
                {!fileExistsOnServer && (
                  <StyledFormLabel>
                    {hiddenInput}
                    {!error && (
                      <Fragment>
                        <Warning />
                        <StyledFormHelperText>
                          Document à envoyer
                        </StyledFormHelperText>
                      </Fragment>
                    )}
                    <CustomColorButton component="span" size="small">
                      Parcourir
                    </CustomColorButton>
                  </StyledFormLabel>
                )}
              </Container>
            )}
          </FormControl>
        </StyledListItem>
        <SideFormLabel>
          {fileExistsOnServer ? (
            isTransmitted ? (
              <SideButton disabled>
                <Check />
                Transmis à Pôle Emploi
              </SideButton>
            ) : (
              <Fragment>
                {hiddenInput}
                <SideButton component="span" size="small">
                  <Autorenew style={{ transform: 'rotate(-90deg)' }} />
                  Remplacer le document
                </SideButton>
              </Fragment>
            )
          ) : (
            allowSkipFile && (
              <Tooltip
                placement="top"
                title={
                  <Typography style={{ color: '#fff' }}>
                    Cochez cette case si vous avez transmis ce document à Pôle
                    Emploi par d'autres moyens que Zen.
                  </Typography>
                }
              >
                <SideButton onClick={this.skipFile}>
                  <CheckBoxOutlineBlank />
                  {/* eslint-disable-next-line no-irregular-whitespace */}
                  Transmis à Pôle Emploi
                </SideButton>
              </Tooltip>
            )
          )}
        </SideFormLabel>
      </StyledContainer>
    )
  }
}

export default DocumentUpload
