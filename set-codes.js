const randomize = require('randomatic')

const generateFor = (char) => {
  const first = randomize('?', 1, {chars: 'abcdefghjkmnpqrstuvwxyz'})
  const second = randomize('?', 2, {chars: '0123456789'})
  return (`${char}${first}${second}`).toUpperCase()
}
const codes = []

for (let i = 0; i < 13; i++) {
  codes.push({'ng-nw-so-2018-04-04-4': {
    vaccinator: generateFor('v'),
    supervisor: generateFor('s'),
    communityLeader: generateFor('c')
  }})
}

console.log(JSON.stringify(codes, null, 2))
