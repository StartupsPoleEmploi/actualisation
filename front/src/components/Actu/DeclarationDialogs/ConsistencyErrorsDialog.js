import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import DialogContentText from '@material-ui/core/DialogContentText'

import CustomColorButton from '../../Generic/CustomColorButton'
import CustomDialog from '../../Generic/CustomDialog'

const ConsistencyErrorsDialogs = ({
  consistencyErrors,
  onCancel,
  confirmAndIgnoreErrors,
  ...props
}) => {
  return (
    <CustomDialog
      content={
        <Fragment>
          <DialogContentText>
            Notre système a détecté de possibles incohérences dans votre
            actualisation{' '}:
          </DialogContentText>
          <ul style={{ padding: 0 }}>
            {consistencyErrors.map((error) => (
              <DialogContentText component="li" key={error}>
                {error}
              </DialogContentText>
            ))}
          </ul>
          <DialogContentText>
            Confirmez-vous ces informations ?
          </DialogContentText>
        </Fragment>
      }
      actions={
        <Fragment>
          <CustomColorButton onClick={onCancel}>
            Je modifie ma déclaration
          </CustomColorButton>
          <Button
            variant="contained"
            onClick={confirmAndIgnoreErrors}
            color="primary"
            autoFocus
          >
            Je valide cette déclaration
          </Button>
        </Fragment>
      }
      {...props}
    />
  )
}

ConsistencyErrorsDialogs.propTypes = {
  onCancel: PropTypes.func.isRequired,
  confirmAndIgnoreErrors: PropTypes.func.isRequired,
  consistencyErrors: PropTypes.arrayOf(PropTypes.string).isRequired,
}

export default ConsistencyErrorsDialogs