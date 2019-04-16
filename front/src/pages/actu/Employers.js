import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Typography from '@material-ui/core/Typography'
import {
  isNaN as _isNaN,
  cloneDeep,
  get,
  isBoolean,
  isNull,
  isObject,
  isUndefined,
  pick,
} from 'lodash'
import moment from 'moment'
import { PropTypes } from 'prop-types'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import styled from 'styled-components'
import superagent from 'superagent'

import DeclarationDialogsHandler from '../../components/Actu/DeclarationDialogs/DeclarationDialogsHandler'
import EmployerQuestion from '../../components/Actu/EmployerQuestion'
import LoginAgainDialog from '../../components/Actu/LoginAgainDialog'
import PreviousEmployersDialog from '../../components/Actu/PreviousEmployersDialog'
import WorkSummary from '../../components/Actu/WorkSummary'
import AlwaysVisibleContainer from '../../components/Generic/AlwaysVisibleContainer'
import MainActionButton from '../../components/Generic/MainActionButton'

import {
  WORK_HOURS,
  SALARY,
  MIN_SALARY,
  MIN_WORK_HOURS,
  MAX_SALARY,
  MAX_WORK_HOURS,
} from '../../lib/salary'

const StyledEmployers = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 4rem; /* space for position:fixed div */
`

const Title = styled(Typography)`
  text-align: center;
  padding-bottom: 1.5rem;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const AddEmployersButtonContainer = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  margin: 3rem 0;
`

const AddEmployersButton = styled(Button)`
  && {
    min-width: 15rem;
    margin: 0 5rem;
  }
`

const LineDiv = styled.div`
  width: 100%;
  max-width: 16.6rem;
  height: 0.1rem;
  background-color: #e4e4e4;
`
const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
  width: 100%;
  text-align: center;
  max-width: 40rem;
  margin: 0 auto;
`

const ErrorMessage = styled(Typography).attrs({
  paragraph: true,
  variant: 'body1',
})`
  && {
    color: red;
    text-align: center;
    margin: auto;
    margin-bottom: 2rem;
    max-width: 70rem;
  }
`

const employerTemplate = {
  employerName: { value: '', error: null },
  workHours: { value: '', error: null },
  salary: { value: '', error: null },
  hasEndedThisMonth: { value: null, error: null },
}

const getEmployersMapFromFormData = (employers) =>
  employers.map((employerFormData) =>
    Object.keys(employerFormData).reduce(
      (obj, fieldName) => ({
        ...obj,
        [fieldName]: employerFormData[fieldName].value,
      }),
      {},
    ),
  )

const getFieldError = ({ name, value }) => {
  const isValid = !isNull(value) && !isUndefined(value) && value !== ''
  if (!isValid) return 'Champ obligatoire'

  if (name === WORK_HOURS) {
    if (_isNaN(value)) {
      return `Merci de ne saisir que des chiffres`
    }
    if (value < MIN_WORK_HOURS || value > MAX_WORK_HOURS) {
      return `Merci de corriger le nombre d'heures travaillées`
    }
  }
  if (name === SALARY) {
    if (_isNaN(value)) {
      return `Merci de ne saisir que des chiffres`
    }
    if (value < MIN_SALARY || value > MAX_SALARY) {
      return `Merci de corriger votre salaire`
    }
  }
  if (name === 'hasEndedThisMonth' && !isBoolean(value)) {
    return 'Merci de répondre à la question'
  }
}

// TODO refactor this, repeated almost exactly in WorkSummary
const calculateTotal = (employers, field) => {
  const total = employers.reduce((prev, employer) => {
    const number = parseFloat(
      isObject(employer[field]) ? employer[field].value : employer[field],
    )
    return number + prev
  }, 0)
  return total
}

// TODO the whole logic of this component needs to be sanitized
export class Employers extends Component {
  static propTypes = {
    activeMonth: PropTypes.instanceOf(Date).isRequired,
    history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
    token: PropTypes.string.isRequired,
  }

  state = {
    employers: [{ ...employerTemplate }],
    previousEmployers: [],
    isLoading: true,
    error: null,
    isDialogOpened: false,
    showPreviousEmployersModal: false,
    consistencyErrors: [],
    validationErrors: [],
    isValidating: false,
    isLoggedOut: false,
  }

  componentDidMount() {
    superagent
      .get('/api/declarations?limit=2')
      .then((res) => res.body)
      .then((declarations) => {
        const currentDeclaration = declarations[0]
        const previousDeclaration = declarations[1]

        this.setState({ currentDeclaration })

        if (currentDeclaration.employers.length === 0) {
          if (!previousDeclaration) return

          const relevantPreviousEmployers = previousDeclaration.employers.filter(
            (employer) => !employer.hasEndedThisMonth,
          )
          if (relevantPreviousEmployers.length === 0) return

          return this.setState({
            employers: relevantPreviousEmployers.map((employer) => ({
              ...employerTemplate,
              employerName: { value: employer.employerName, error: null },
            })),
            previousEmployers: relevantPreviousEmployers,
            showPreviousEmployersModal: true,
          })
        }

        this.setState({
          employers: currentDeclaration.employers.map((employer) =>
            Object.keys(
              pick(employer, [
                'employerName',
                'workHours',
                'salary',
                'hasEndedThisMonth',
                'id',
              ]),
            ).reduce(
              (obj, fieldName) => ({
                ...obj,
                [fieldName]: { value: employer[fieldName], error: null },
              }),
              {},
            ),
          ),
        })
      })
      .then(() => this.setState({ isLoading: false }))
  }

  componentWillUnmount() {
    // Save at exit, but avoid saving in case where the user is redirected somewhere else
    // So we make sure data was loaded, and curent declaration hasn't been validated for employers yet
    if (
      !this.state.isLoading &&
      !this.hasSubmittedAndFinished &&
      get(this.state.currentDeclaration, 'hasFinishedDeclaringEmployers') ===
        false
    ) {
      this.onSave()
    }
  }

  addEmployer = () =>
    this.setState(({ employers }) => ({
      employers: employers.concat({ ...employerTemplate }),
    }))

  // onChange - let the user type whatever he wants, show errors
  onChange = ({ index, name, value }) => {
    const error = getFieldError({ name, value })

    this.updateValue({ index, name, value, error })
  }

  updateValue = ({ index, name, value, error }) =>
    this.setState(({ employers: prevEmployers }) => ({
      employers: prevEmployers.map((employer, key) =>
        key === index ? { ...employer, [name]: { value, error } } : employer,
      ),
      error: null,
    }))

  onRemove = (index) =>
    this.setState(({ employers }) => ({
      employers: employers.filter((e, key) => key !== index),
    }))

  onSave = () =>
    superagent
      .post('/api/employers', {
        employers: getEmployersMapFromFormData(this.state.employers),
      })
      .set('CSRF-Token', this.props.token)
      .then((res) => res) // Not triggered without a then

  saveAndRedirect = () =>
    this.onSave().then(() => this.props.history.push('/thanks?later'))

  onSubmit = ({ ignoreErrors = false } = {}) => {
    this.setState({ isValidating: true })

    return superagent
      .post('/api/employers', {
        employers: getEmployersMapFromFormData(this.state.employers),
        isFinished: true,
        ignoreErrors,
      })
      .set('CSRF-Token', this.props.token)
      .then(() => {
        this.hasSubmittedAndFinished = true // used to cancel cWU actions
        this.props.history.push('/files')
      })
      .catch((err) => {
        if (
          err.status === 400 &&
          (get(err, 'response.body.consistencyErrors.length', 0) ||
            get(err, 'response.body.validationErrors.length', 0))
        ) {
          // We handle the error inside the modal
          return this.setState({
            consistencyErrors: err.response.body.consistencyErrors,
            validationErrors: err.response.body.validationErrors,
            isValidating: false,
          })
        }

        // Reporting here to get a metric of how much next error happens
        window.Raven.captureException(err)

        if (err.status === 401 || err.status === 403) {
          this.closeDialog()
          this.setState({ isLoggedOut: true })
          return
        }

        // Unhandled error
        this.setState({
          error: `Nous sommes désolés, mais une erreur s'est produite. Merci de réessayer ultérieurement.
          Si le problème persiste, merci de contacter l'équipe Zen, et d'effectuer
          en attendant votre actualisation sur Pole-emploi.fr.`,
        })
        this.closeDialog()
      })
  }

  checkFormValidity = () => {
    if (this.state.employers.length === 0) {
      this.setState({
        error: `Merci d'entrer les informations sur vos employeurs`,
      })
      return false
    }

    let isFormValid = true
    const employersFormData = cloneDeep(this.state.employers)

    this.state.employers.forEach((employer, index) =>
      Object.keys(employer).forEach((fieldName) => {
        const error = getFieldError({
          name: fieldName,
          value: employer[fieldName].value,
        })

        if (error) isFormValid = false

        employersFormData[index][fieldName] = {
          value: employer[fieldName].value,
          error,
        }
      }),
    )

    let error = `Merci de corriger les erreurs du formulaire. `

    if (isFormValid) {
      const workHoursTotal = calculateTotal(employersFormData, WORK_HOURS)
      const salaryTotal = calculateTotal(employersFormData, SALARY)

      if (workHoursTotal > MAX_WORK_HOURS) {
        error += `Vous ne pouvez pas déclarer plus de ${MAX_WORK_HOURS}h totales de travail. `
        isFormValid = false
      }
      if (salaryTotal > MAX_SALARY) {
        error += `Vous ne pouvez pas déclarer plus de ${MAX_SALARY}€ total de salaire. `
        isFormValid = false
      }
    }

    if (!isFormValid) {
      this.setState({
        employers: employersFormData,
        error: isFormValid ? null : error,
      })
    }

    return isFormValid
  }

  openDialog = () => {
    const isValid = this.checkFormValidity()
    if (isValid) {
      this.setState({ isDialogOpened: true })
    }
  }

  closeDialog = () => {
    this.setState({
      consistencyErrors: [],
      validationErrors: [],
      isDialogOpened: false,
      isValidating: false,
    })
  }

  closePreviousEmployersModal = () =>
    this.setState({ showPreviousEmployersModal: false })

  renderEmployerQuestion = (data, index) => (
    <EmployerQuestion
      {...data}
      key={index}
      index={index}
      onChange={this.onChange}
      onRemove={this.onRemove}
      activeMonth={this.props.activeMonth}
    />
  )

  render() {
    const { employers, error, isLoading } = this.state

    if (isLoading) {
      return (
        <StyledEmployers>
          <CircularProgress />
        </StyledEmployers>
      )
    }
    return (
      <StyledEmployers>
        <Title variant="h6" component="h1">
          Pour quels employeurs avez-vous travaillé en{' '}
          {moment(this.props.activeMonth).format('MMMM YYYY')}
          {' '}?
        </Title>
        <Form>
          {employers.map(this.renderEmployerQuestion)}

          <AddEmployersButtonContainer>
            <LineDiv />
            <AddEmployersButton
              variant="outlined"
              color="primary"
              onClick={this.addEmployer}
              size="small"
            >
              + Ajouter un employeur
            </AddEmployersButton>
            <LineDiv />
          </AddEmployersButtonContainer>

          <WorkSummary employers={employers} />

          <AlwaysVisibleContainer
            style={{ marginTop: '2rem', alignSelf: 'stretch' }}
          >
            {error && <ErrorMessage>{error}</ErrorMessage>}

            <ButtonsContainer>
              <MainActionButton primary={false} onClick={this.saveAndRedirect}>
                Enregistrer
                <br />
                et finir plus tard
              </MainActionButton>
              <MainActionButton primary onClick={this.openDialog}>
                Envoyer mon
                <br />
                actualisation
              </MainActionButton>
            </ButtonsContainer>
          </AlwaysVisibleContainer>
        </Form>

        <DeclarationDialogsHandler
          isLoading={this.state.isValidating}
          isOpened={this.state.isDialogOpened}
          onCancel={this.closeDialog}
          onConfirm={this.onSubmit}
          declaration={this.state.currentDeclaration}
          employers={this.state.employers}
          consistencyErrors={this.state.consistencyErrors}
          validationErrors={this.state.validationErrors}
        />
        <LoginAgainDialog isOpened={this.state.isLoggedOut} />
        <PreviousEmployersDialog
          isOpened={this.state.showPreviousEmployersModal}
          onCancel={this.closePreviousEmployersModal}
          employers={this.state.previousEmployers}
        />
      </StyledEmployers>
    )
  }
}

export default withRouter(Employers)
