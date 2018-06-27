import 'moment/locale/fr'

import CssBaseline from '@material-ui/core/CssBaseline'
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import moment from 'moment'
import React, { Fragment } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter } from 'react-router-dom'

import { version } from '../package.json'
import App from './App'

// import registerServiceWorker from './registerServiceWorker'

const environment = process.env.REACT_APP_SENTRY_ENV || process.env.NODE_ENV

if (environment !== 'development') {
  window.Raven.config(
    'https://a1844e1ab4404bf9b6b63fe127874cdf@sentry.io/1216087',
    {
      release: version,
      environment,
    },
  ).install()
}

moment.locale('fr')

const theme = createMuiTheme({
  typography: {
    // Tell Material-UI what's the font-size on the html element is.
    htmlFontSize: 10,
    fontFamily: [
      'filson-soft',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  palette: {
    primary: {
      main: '#7cdd91',
      contrastText: '#fff',
    },
    secondary: {
      main: '#7cdd91',
    },
  },
  overrides: {
    MuiButton: {
      root: {
        textTransform: 'none',
      },
    },
  },
})

ReactDOM.render(
  <Fragment>
    <CssBaseline />
    <MuiThemeProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MuiThemeProvider>
  </Fragment>,
  document.getElementById('root'),
)

/*
TODO restore and configure this correctly in production.
registerServiceWorker()
*/
