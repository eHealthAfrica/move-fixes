'use strict'

const utility = require('dev-utility/utility')
const _ = require('lodash')
const request = require('request-promise')
const Promise = require('bluebird')
const path = require('path')

const Utility = require('./utility')
const cleanObject = require('./resources/hf-clean-up-data.json')

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'

if (!process.env.COUCHDB_URL) {
  console.log(
    `
    No COUCHDB_URL provided defaulting to ${COUCHDB_URL}
    url format without auth http(s)//x.x.x.x(:5984)
    with auth http(s)//username:password@x.x.x.x(:5984)
    `
  )
}
const csv = utility.csvToJSON(utility.loadFile(path.resolve('./resources/facilities.csv')))
const count = {
  matching: 0,
  notMatching: 0
}

const csvObject = csv.reduce((results, object) => {
  let name = (object['facility'] || '').trim()
  name = Utility.replaceFromMap(name, cleanObject)
  results[name] = object
  return results
}, {})

const updateLocations = (csvObject, locationsObject, facilityObject, allFacilities) => {
  const inputFacilityList = Object.keys(csvObject)
  inputFacilityList.sort()
  inputFacilityList.forEach((name) => {
    const data = csvObject[name]

    const wardName = (data['ward'] || '').trim()
    let ward = null
    let ancestors = []
    const matchedName = Utility.closestMatch(name, allFacilities)

    if (locationsObject[wardName] && locationsObject[wardName].adminLevel === 'admin-level:ward') {
      ward = locationsObject[wardName]
      const wardAncestors = [
        {
          _id: ward._id,
          level: 3
        }
      ]
      ancestors = ancestors.concat(ward.ancestors, wardAncestors)
    }

    if (facilityObject[matchedName] && ancestors.length > 0) {
      count.matching++
      facilityObject[matchedName].location = facilityObject[matchedName].location || {
        gps: {
          lat: null,
          long: null
        }
      }
      facilityObject[matchedName].location.ancestors = ancestors
      facilityObject[matchedName].name = matchedName
    } else {
      count.notMatching++
    }
  })

  return _.values(facilityObject)
}

const fetchLocations = () => {
  const options = {
    url: `${COUCHDB_URL}/move_db/_design/location/_view/all?reduce=false&include_docs=true`,
    json: true
  }
  return request.get(options)
}

const fetchFacilities = () => {
  const options = {
    url: `${COUCHDB_URL}/move_db/_design/facility/_view/by-id?include_docs=true&reduce=false`,
    json: true
  }
  return request.get(options)
}

const promises = {
  locations: fetchLocations(),
  facilities: fetchFacilities()
}

console.log(`fetching facilities and locations form ${COUCHDB_URL}`)
Promise.props(promises)
  .then(response => {
    const facilities = response.facilities.rows.map(data => data.doc)
    const locations = response.locations.rows.map(data => data.doc)

    const wards = locations.filter(location => location.adminLevel === 'admin-level:ward')
    const locationsObject = utility.arrayToObject(wards, 'name')
    const facilityObject = facilities.reduce((results, object) => {
      let name = (object.name || '').trim()
      name = Utility.replaceFromMap(name, cleanObject)
      results[name] = object
      return results
    }, {})
    const allFacilities = Object.keys(facilityObject)

    const updatedList = updateLocations(csvObject, locationsObject, facilityObject, allFacilities)
    console.log(`${count.matching} was updated out of ${allFacilities.length} Facilities`)
    console.log(`pushing updates to couchdb server at ${COUCHDB_URL} ...`)
    return request.post({url: `${COUCHDB_URL}/move_db/_bulk_docs`, body: {docs: updatedList}, json: true})
  })
  .then(response => {
    console.log(`documents updates completed`)
    console.log(response.message)
  })
  .catch(error => {
    console.log(error.message)
  })
