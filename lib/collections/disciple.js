module.exports = {

  adapter: 'mongodb',

  attributes: {
    clientId: {
      type: 'string',
      required: false
    },
    discipleId: {
      type: 'string',
      required: false
    },
    model: {
      type: 'string',
      required: false
    },
    hostname: {
      type: 'string',
      required: false
    },
    status: {
      type: 'string',
      required: false
    },
    cpus: {
      type: 'array',
      required: false
    },
    os: {
      type: 'array',
      required: false
    },
    ram: {
      type: 'integer',
      required: false
    },
  }
}