'use strict'

const utility = require('dev-utility/utility')
const request = require('request-promise')
const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const Utility = require('./utility')
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:admin@127.0.0.1:5984'

const nassarawa = utility.csvToJSON(utility.loadFile(path.resolve('./resources/nassarawa-zone.csv')))
const wudil = utility.csvToJSON(utility.loadFile(path.resolve('./resources/wudil-zone.csv')))


class SetUpProductLevels {
  productLevelByFacility = {}

  notFoundFacilities = []

  altNames = {
    ungongo: 'Ungogo',
    fanisau: 'Panisau',
    sheshe: 'She she',
    'tudun-wada': 'Tudun Wada',
    'tudun murtala': 'Tudun Wada',
    'hotoro south': 'Hotoro North',
    'kabuwaya': 'Kabuwaya / Makafin-Dala',
    'nasarawa': 'Nassarawa',
    'shahuchi': 'Shahuci',
    'gandun albasa': 'Gandu Albasa',
    'kunkurawa': 'Kunkun Rawa',
    'katumari': 'Katurmari'
  }

  productList = [
    'bcg',
    'ms',
    'yf',
    'opv',
    'ipv',
    'td',
    'penta',
    'pcv',
    'hbv',
    'ms-dil',
    'yf-dil',
    'bcg-dil',
    '0.05ml',
    '0.5ml',
    '2ml',
    '5ml',
    's/box',
    'droppers',
    'im'
  ]

  facilityList = [].concat(nassarawa, wudil)

  fetchFacilities () {
    const options = {
      url: `${COUCHDB_URL}/move_db/_design/facility/_view/by-id?include_docs=true&reduce=false`,
      json: true
    }
    return request.get(options)
  }

  fetchLocations () {
    const options = {
      url: `${COUCHDB_URL}/move_db/_design/location/_view/all?reduce=false&include_docs=true`,
      json: true
    }
    return request.get(options)
  }

  buildLocationNames (ancestors = [], locationObject) {
    const locationNames = {}
    ancestors.forEach(ancestor => {
      if (ancestor.level === 1) {
        locationNames.zone = (locationObject[ancestor._id] || {}).name || ''
      }

      if (ancestor.level === 2) {
        locationNames.lga = (locationObject[ancestor._id] || {}).name || ''
      }

      if (ancestor.level === 3) {
        locationNames.ward = (locationObject[ancestor._id] || {}).name || ''
      }
    })
    return locationNames
  }

  replaceLocation (altOption, name) => {
    return altOption[(name || '').toLowerCase()] || name
  }

  compare (first, second) {
    return (first || '').toLowerCase().trim() === (second || '').toLowerCase().trim()
  }

  buildProduct (product, maxObject) {
    const altNamesProducts = {
      ms: 'mv',
      im: 'cards',
      's/box': 'safety-boxes',
      '2ml': 'rc-2ml',
      '5ml': 'rc-5ml',
      'ms-dil': 'mv-dil'
    }
    product = altNamesProducts[product] || product
    const key = `[max]-${product}`
    const max = parseInt(maxObject[key], 10) || 0
    return {
      max: max,
      min: parseInt(((25 / 100) * max).toFixed(0), 10),
      reorderLevel: parseInt(((40 / 100) * max).toFixed(0))
    }
  }

  buildProducts (object, maxObject) {
    productList.forEach(product => {
      object[product] = buildProduct(product, maxObject)
    })
    return object
  }

  processFacilities (facilityList, facilityNamesFromDB, indexedFacilitiesFromDB) {
    facilityList.forEach(facility => {
      const name = facility['facility-name']
      const matchedName = Utility.closestMatch(name, facilityNamesFromDB)
      const zone = replaceLocation(altNames, facility['zone'])
      const lga = replaceLocation(altNames, facility['lga'])
      const ward = replaceLocation(altNames, facility['ward'])

      let matchedObject = {
        name: matchedName,
        locationNames: {
          zone: '',
          ward: '',
          lga: ''
        }
      }
      if (matchedName && indexedFacilitiesFromDB[matchedName]) {
        matchedObject = indexedFacilitiesFromDB[matchedName]
        matchedObject.locationNames.zone = replaceLocation(altNames, matchedObject.locationNames.zone)
        matchedObject.locationNames.ward = replaceLocation(altNames, matchedObject.locationNames.ward)
        matchedObject.locationNames.lga = replaceLocation(altNames, matchedObject.locationNames.lga)
      }
      if (
        zone &&
        compare(zone, matchedObject.locationNames.zone) &&
        compare(matchedObject.locationNames.lga, lga) &&
        compare(matchedObject.locationNames.ward, ward)
      ) {
        productLevelByFacility[matchedObject._id] = buildProducts({}, facility)
      } else {
        console.log(zone, matchedObject.locationNames.zone, matchedObject.locationNames.lga, lga, matchedObject.locationNames.ward, ward)
      }
    })
  }

  run () {
    const promises = {
      locations: fetchLocations(),
      facilities: fetchFacilities()
    }

    console.log(`fetching facilities and locations form ${COUCHDB_URL}`)
    Promise.props(promises)
      .then(response => {
        const locationObject = response.locations.rows.reduce((result, location) => {
          result[location.doc._id] = location.doc
          return result
        }, {})

        const indexedFacilitiesFromDB = response.facilities.rows
          .filter(resp => resp.doc.location)
          .reduce((result, facility) => {
            const ancestors = (facility.doc.location || {}).ancestors || []
            facility.doc.locationNames = buildLocationNames(ancestors, locationObject)
            result[facility.doc.name] = facility.doc
            return result
          }, {})

        const facilityNamesFromDB = Object.keys(indexedFacilitiesFromDB)
        processFacilities(facilityList, facilityNamesFromDB, indexedFacilitiesFromDB)
        fs.writeFileSync('resources/product-level.json', JSON.stringify(productLevelByFacility, null, 2))
      })
      .catch(error => console.error(error))
  }
}