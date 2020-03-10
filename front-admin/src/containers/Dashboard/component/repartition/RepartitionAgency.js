/* eslint-disable react/jsx-one-expression-per-line */
import React, { useEffect, useState } from 'react'
import superagent from 'superagent'
import { Button, Icon, Spin } from 'antd'
import moment from 'moment'
import { useHistory } from 'react-router-dom'
import { getAgence } from '../../../../common/agencesInfos'
import { URLS } from '../../../../common/routes'

function RepartitionAgency({ agencyCode, declarationMonth }) {
  const [values, setValues] = useState(null)
  const [agency] = useState(getAgence(agencyCode))
  const history = useHistory()

  useEffect(() => {
    async function fetchData() {
      if (!agency) return
      const { body } = await superagent.get(
        `/zen-admin-api/repartition/agency?agencyCode=${agency.codeAgence}&monthId=${declarationMonth.id}`,
      )
      setValues(body)
    }
    fetchData()
  }, [agency, declarationMonth])

  if (!values) return <Spin />

  return (
    <div>
      <h1>
        {agency.nomAgence} dans {agency.departement} en {agency.region} (code
        agence : {agencyCode})
      </h1>
      <h2>
        Actualisation de {moment(declarationMonth.month).format('MMM YYYY')}
      </h2>
      {!values.length && <strong>Aucune actualisation trouvée</strong>}
      {values.length > 0 && (
        <>
          <h3 style={{ fontWeight: 'bold' }}>
            {values.length} actualisations réalisées
          </h3>
          <table style={{ width: '100%', marginTop: '3rem' }}>
            <thead>
              <tr>
                <th>Prénom Nom</th>
                <th>Déclaration démarrée le :</th>
                <th>Déclaration</th>
              </tr>
            </thead>
            <tbody>
              {values.map(
                ({ id, createdAt, user: { firstName, lastName } }) => (
                  <tr>
                    <td>
                      {firstName} {lastName}
                    </td>
                    <td>{moment(createdAt).format('DD-MM-YYYY')}</td>
                    <td>
                      <Button
                        onClick={() => history.push(URLS.DECLARATIONS.view(id))}
                      >
                        <Icon type="eye" style={{ color: 'blue' }} />
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default RepartitionAgency