import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Button } from '@material-ui/core'

const LinkButton = ({ children, to, ...props }) => (
  <Button variant="raised" component={(props) => <Link to={to} {...props} />}>
    {children}
  </Button>
)

LinkButton.propTypes = {
  children: PropTypes.node,
  to: PropTypes.string,
}

export default LinkButton
