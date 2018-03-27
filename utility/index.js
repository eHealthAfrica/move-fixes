'use strict'

class Utility {
  static closestMatch (text, list) {
    let i = list.length
    const matches = []
    while (i--) {
      const testKey = list[i]
      let firstWord = (text || '').split(' ')[0]
      const firstFromTest = (testKey).split(' ')[0]
      if (firstWord === firstFromTest) {
        matches.push(testKey)
      }
    }
    return matches[0] || null
  }

  static toTitleCase (str) {
    return (str || '').replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase() })
  }

  static replaceFromMap (str, hashMap) {
    str = str.split(' ')
    var cleaned = []
    var i = str.length
    while (i--) {
      var word = str[i].toLowerCase()
      if (hashMap.hasOwnProperty(word)) {
        word = hashMap[word]
      }
      cleaned.unshift(word)
    }
    cleaned = Utility.toTitleCase(cleaned.join(' '))
    return cleaned
  }
}

module.exports = Utility
