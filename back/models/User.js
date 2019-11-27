const { HasManyRelation } = require('objection')
const BaseModel = require('./BaseModel')

class User extends BaseModel {
  static get tableName() {
    return 'Users'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['peId', 'firstName', 'lastName'],

      properties: {
        id: { type: 'integer' },
        peId: { type: 'string', minLength: 1, maxLength: 100 },
        firstName: { type: 'string', minLength: 1, maxLength: 30 },
        lastName: { type: 'string', minLength: 1, maxLength: 85 },
        gender: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        postalCode: { type: ['string', 'null'] },
        isAuthorized: { type: 'boolean' },
        canMakeMonthDeclaration: { type: 'boolean' },
        canMakeDeclaration: { type: 'boolean' },
        lastDocsReminderDate: { type: ['string', 'object', 'null'] },
      },
    }
  }

  // This object defines the relations to other models.
  static get relationMappings() {
    return {
      employers: {
        relation: HasManyRelation,
        modelClass: `${__dirname}/Employer`,
        join: {
          from: 'Users.id',
          to: 'employers.userId',
        },
      },
      declarations: {
        relation: HasManyRelation,
        modelClass: `${__dirname}/Declaration`,
        join: {
          from: 'Users.id',
          to: 'declarations.userId',
        },
      },
    }
  }
}

module.exports = User
