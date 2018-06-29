import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import PropTypes from 'prop-types'
import React, { Component, Fragment } from 'react'
import styled from 'styled-components'

const MainListItem = styled(ListItem)`
  && {
    padding-top: 2rem;
    flex-wrap: wrap;
  }
`

const SubListItem = styled(ListItem)`
  && {
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-top: 0;
    flex-wrap: wrap;
  }
`

const getFormValue = (value) => (value === null ? value : value ? 'yes' : 'no')

export class DeclarationQuestion extends Component {
  static propTypes = {
    children: PropTypes.node,
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    onAnswer: PropTypes.func.isRequired,
    value: PropTypes.bool,
    withChildrenOnNo: PropTypes.bool,
  }

  handleChange = ({ target: { value } }) => {
    this.props.onAnswer({
      hasAnsweredYes: value === 'yes',
      controlName: this.props.name,
    })
  }

  render() {
    const { children, label, value, withChildrenOnNo } = this.props
    return (
      <Fragment>
        <MainListItem>
          <ListItemText primary={label} />
          <FormControl component="fieldset" required error>
            <RadioGroup
              row
              aria-label="oui ou non"
              name="yesOrNo"
              value={getFormValue(value)}
              onChange={this.handleChange}
            >
              <FormControlLabel
                value="yes"
                control={<Radio color="primary" />}
                label="Oui"
              />
              <FormControlLabel
                value="no"
                control={<Radio color="primary" />}
                label="Non"
              />
            </RadioGroup>
          </FormControl>
        </MainListItem>
        {getFormValue(value) === (withChildrenOnNo ? 'no' : 'yes') &&
          children && <SubListItem>{children}</SubListItem>}
      </Fragment>
    )
  }
}

export default DeclarationQuestion
