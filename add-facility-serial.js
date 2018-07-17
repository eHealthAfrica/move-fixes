'use strict'

import padStart from 'lodash/padStart'

import Common from './common'

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'
const COUCHDB_DB = process.env.COUCHDB_DB || 'move_db'

const common = new Common(COUCHDB_URL, COUCHDB_DB)

if (!process.env.COUCHDB_URL) {
  console.log(
    `
    No COUCHDB_URL provided defaulting to ${COUCHDB_URL}
    url format without auth http(s)//x.x.x.x(:5984)
    with auth http(s)//username:password@x.x.x.x(:5984)
    `
  )
}

common.fetchFacilities()
  .then(facilities => {
    return facilities.rows
      .sort((a, b) => new Date(a.doc.created).getTime() > new Date(b.doc.created).getTime())
  })
  .then(facilities => {
    let lastNumber = 0
    return facilities
      .filter(facility => facility.doc.doc_type === 'facility')
      .map(facility => {
        lastNumber++
        facility.doc.serial = padStart(String(lastNumber), 4, '0')
        return facility.doc
      })
  })
  .then(formatted => {
    console.log(JSON.stringify(formatted, null, 2))
    return common.bulkDocs(formatted)
  })
  .then(response => console.log(JSON.stringify(response, null, 2)))
  .catch(console.error)
