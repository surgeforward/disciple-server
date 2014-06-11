module.exports = {

  adapter: 'mongodb',

  attributes: {
    name: {
      type: 'string',
      required: true
    },
    description: {
      type: 'string',
      required: true
    },
    type: {
      type: 'string',
      required: true
    },
    connection: {
      type: 'array',
      required: true
    },
    filters: {
      type: 'array',
      required: false
    }
  }
}