var Boom = require('boom');
var Hoek = require('hoek');
var Joi = require('joi');
var Config = require('config');
var ChangeCaseKeys = require('change-case-keys');
var Callsite = require('callsite');
var _s = require('underscore.string');
//  var _ = require('underscore');
//  var _s = require('underscore.string');


//  var db = require(Config.get("rootPath") + "/database");

//  var BaseC = require("../../server/models/base-model.js").collection;
//        var utils = require('../../server/common/utils.js');
//        var transforms = require('../../server/common/transforms.js');
//        var pre = require('../../server/common/pre.js');

var internals = {

    abortIfNotAuthenticated: function(request, reply) {
        // with NODE_ENV=dev-no-auth, all routes have "config: false"
        if (request.route.settings.auth !== false) {
            if (!request.auth.credentials.id) {
                return reply(Boom.unauthorized("To access this resource you must be authenticated."));
            }
        }

        return reply();
    },

    logStack: function(server, callsiteObj) {

        var output = '\x1b[36m' + (callsiteObj.getFunctionName() || 'anonymous') + '()\x1b[90m in ' + callsiteObj.getFileName() + ":" +
            +callsiteObj.getLineNumber();

        server.log(["stack"], output);

        return output;
    },

    transformArray: function(array, transform) {
        return array.map(function(obj) {
            return Hoek.transform(obj, transform);
        });
    },

    validate: {
        ids: function(value, options, next) {

            value.ids = _s.trim(value.ids, ",").split(",");

            var idSchema = Joi.number().integer().min(0);

            // must be an objet like this: { ids: [3,5,7] }
            var schema = Joi.object().keys({
                ids: Joi.array().unique().items(idSchema)
            });

            var validation = Joi.validate(value, schema, Config.get('hapi.joi'));

            if (validation.error) {
                return next(validation.error);
            }

            // at this point validation.value is on object of the form { ids: [3] } or { ids: [3,5] }; we want it to be
            // { ids: [{id: 3}, {id: 5}] }  (then we simply have pass the [{id: 3}, {id: 5}] to the postgres function)
            validation.value.ids = validation.value.ids.map(function(id) {
                return {
                    "id": id
                };
            });

            return next(undefined, validation.value);
        },
    }
};





internals.resourceName = "texts";
internals.resourcePath = Config.get("apiRoutePrefix.v1") + "/texts";


// validate the ids param in the URL
internals.validatex = {
    params: {},
    /*
      id: function(value, options, next){
        console.log("validateIds");
      debugger;

        value.ids = _s.trim(value.ids, ",").split(",");


        var idSchema = Joi.number().integer().min(0);

        // must be an objet like this: { ids: [3,5,7] }
        var schema = Joi.object().keys({
            ids: Joi.array().unique().includes(idSchema)
        });

        var validation = Joi.validate(value, schema, Config.get('hapi.joi'));

        if(validation.error){  return next(validation.error);  }

        return next(undefined, validation.value);
      },
    */

    payloadForCreate: function(value, options, next) {

        console.log("validatePayloadForCreate");

        var schemaCreate = Joi.object().keys({
            id: Joi.number().integer().min(0),

            //tags: Joi.string().allow("").regex(/^[-\w\s]+(?:,[-\w\s]+)*$/),
            //tags: Joi.alternatives().try(Joi.string().allow("").regex(/^[-\w\s]+(?:,[-\w\s]+)*$/), Joi.string().allow("")),
            tags: Joi.string().allow(""),

            contents: Joi.object().keys({
                pt: Joi.string().allow(""),
                en: Joi.string().allow("")
            }).required(),

            description: Joi.object().keys({
                pt: Joi.string().allow(""),
                en: Joi.string().allow("")
            }),

            properties: Joi.object(),

            active: Joi.boolean()
        });

        return internals.validate.payload(value, options, next, schemaCreate);
    },


    payloadForUpdate: function(value, options, next) {

        console.log("validatePayloadForUpdate");

        var schemaUpdate = Joi.object().keys({
            id: Joi.number().integer().min(0).required(),

            //tags: Joi.array().unique().min(0).includes(Joi.string()),
            //tags: Joi.string().regex(/^[-\w\s]+(?:,[-\w\s]+)*$/),
            tags: Joi.string().allow(""),

            contents: Joi.object().keys({
                pt: Joi.string().allow(""),
                en: Joi.string().allow("")
            }).required(),

            description: Joi.object().keys({
                pt: Joi.string().allow(""),
                en: Joi.string().allow("")
            }),

            properties: Joi.object(),

            active: Joi.boolean()
        });

        return internals.validate.payload(value, options, next, schemaUpdate);
    },

    payload: function(value, options, next, schema) {
        debugger;

        if (_.isObject(value) && !_.isArray(value)) {
            value = [value];
        }

        // validate the elements of the array using the given schema
        var validation = Joi.validate(value, Joi.array().includes(schema), Config.get('hapi.joi'));

        if (validation.error) {
            return next(validation.error);
        }


        // validateIds was executed before this one; the ids param (if defined) is now an array of integers
        var ids = options.context.params.ids;

        // finally, if the ids param is defined, make sure that the ids in the param and the ids in the payload are consistent
        if (ids) {
            for (var i = 0, l = validation.value.length; i < l; i++) {
                // ids in the URL param and ids in the payload must be in the same order
                if (ids[i] !== validation.value[i].id) {
                    return next(Boom.conflict("The ids given in the payload and in the URI must match (including the order)."));
                }
            }
        }

        // update the value that will be available in request.payload when the handler executes;
        // there are 2 differences: a) Joi has coerced the values to the type defined in the schemas;
        // b) the keys will be in underscored case (ready to be used by the postgres functions)
        return next(undefined, ChangeCaseKeys(validation.value, "underscored"));
    }
}




internals.validate.xpayload = function(value, options, next, schema) {
    debugger;

    if (_.isObject(value) && !_.isArray(value)) {
        value = [value];
    }

    // validate the elements of the array using the given schema
    var validation = Joi.validate(value, Joi.array().includes(schema), Config.get('hapi.joi'));

    if (validation.error) {
        return next(validation.error);
    }


    // validateIds was executed before this one; the ids param (if defined) is now an array of integers
    var ids = options.context.params.ids;

    // finally, if the ids param is defined, make sure that the ids in the param and the ids in the payload are consistent
    if (ids) {
        for (var i = 0, l = validation.value.length; i < l; i++) {
            // ids in the URL param and ids in the payload must be in the same order
            if (ids[i] !== validation.value[i].id) {
                return next(Boom.conflict("The ids given in the payload and in the URI must match (including the order)."));
            }
        }
    }

    // update the value that will be available in request.payload when the handler executes;
    // there are 2 differences: a) Joi has coerced the values to the type defined in the schemas;
    // b) the keys will be in underscored case (ready to be used by the postgres functions)
    return next(undefined, ChangeCaseKeys(validation.value, "underscored"));
};



internals.pre = {

    getAllTexts: {
        method: function(request, reply) {

            return internals.db
                .func('texts_read')
                .then(function(data) {
                    return reply(data);
                })
                .catch(function(errMsg) {
                    return reply(Boom.badImplementation(errMsg));
                });
        },
        assign: "allTexts"
    },

    getTextsById: {
        method: function(request, reply) {

            return internals.db
                .func('texts_read', JSON.stringify(request.params.ids))
                .then(function(data) {
                    return reply(data);
                })
                .catch(function(errMsg) {
                    return reply(Boom.badImplementation(errMsg));
                });
        },
        assign: "textsById"
    }
};

internals.transforms = {

    text: {
        // a) properties to be maintained
        "id": "id",
        "tags": "tags",
        "contents": "contents",
        "lastUpdated": "last_updated",

        // b) new properties (move properties from the nested object to the top object)
        // NOTE: this is used to make the server-side templates lighter
        //          "pt": "contents.pt",
        //          "en": "contents.en",

        // c) changed properties (some fields from authorData, such as pwHash, will be deleted)

        // the changeCaseKeys is only changinf the 1st level keys
        "authorData.id": "author_data.id",
        "authorData.firstName": "author_data.first_name",
        "authorData.lastName": "author_data.last_name",
        "authorData.email": "author_data.email",

        // d) deleted properties: "contentsDesc", "authorId", "active"
    }
};


/*
exports.getTextsById = {
    method: function(request, reply){
        console.log("pre: db.getTextById");
        var textsC = new BaseC();

        textsC
            .execute({
                query: {
                    command: "select * from texts_read($1)",
                    arguments: [JSON.stringify( {id: request.params.ids[0]} )]
                },
            })
            .then(function() {
                return reply(textsC);
            })
            .done();
    },
    assign: "textsById",
};

exports.transforms = {};

exports.transforms.texts = {
    method: function(request, reply){
        console.log("pre: transform.texts");

        var transformMap = transforms.maps.texts
        var transform    = transforms.transformArray;

        var textsArray = transform(request.pre.textsC.toJSON(), transformMap);

        // manually copy the properties in the contents to the top level (to make the nunjucks templates easier)
        for(var i=0, l=textsArray.length;  i<l;  i++){
            (textsArray[i]).pt = (textsArray[i]).contents.pt;
            (textsArray[i]).en = (textsArray[i]).contents.en;
        }

        // transform the array into an object, indexed by the id; this will make it easy to access an arbitrary text,
        // and will avoid using sparse arrays
        var textsObj = _.indexBy(textsArray, "id");

        return reply(textsObj);
    },

    assign: "texts"
};

exports.transforms.textsArray = {
    method: function(request, reply){
        console.log("pre: transform.textsArray");

        var transformMap = transforms.maps.texts;
        var transform    = transforms.transformArray;

        var textsArray = transform(request.pre.textsC.toJSON(), transformMap);

        // manually copy the properties in the contents to the top level (to make the nunjucks templates easier)
        for(var i=0, l=textsArray.length;  i<l;  i++){
            (textsArray[i]).pt = (textsArray[i]).contents.pt;
            (textsArray[i]).en = (textsArray[i]).contents.en;
        }

        return reply(textsArray);
    },

    assign: "textsArray"
};
*/


// plugin defintion function
exports.register = function(server, options, next) {

    //internals.db = options.db;
    internals.abortIfNotAuthenticated = options.abortIfNotAuthenticated || internals.abortIfNotAuthenticated;
    internals.transformArray = options.transformArray || internals.transformArray;
    internals.logStack = options.logStack || internals.logStack;
    internals.validate.ids = (options.validate && options.validate.ids) || internals.validate.ids;
    //internals.readAll = options.readAll;
    //internals.read = options.read;
    //internals.create = options.create;
    //internals.delete = options.delete;

    // READ (all)
    server.route({
        method: 'GET',
        path: internals.resourcePath,
        handler: function readAllTexts(request, reply) {

            internals.logStack(server, Callsite()[0]);
            return options.readAll.handler(request, reply, server, options);
        },

        config: options.readAll.config
    });


    // READ (one or more, but not all)
    server.route({
        method: 'GET',
        path: internals.resourcePath + "/{ids}",
        handler: function readTexts(request, reply) {

            internals.logStack(server, Callsite()[0]);
            return options.read.handler(request, reply, server, options);
        },

        config: options.read.config
    });

    // CREATE (one or more)
    server.route({
        method: 'POST',
        path: internals.resourcePath,
        handler: function createText(request, reply) {

            internals.logStack(server, Callsite()[0]);
            return options.create.handler(request, reply, server, options);
        },

        config: options.create.config
    });

    /*
          // UPDATE (one or more)
          server.route({
              method: 'PUT',
              path: internals.resourcePath + "/{ids}",
              handler: function (request, reply) {

                  console.log(utils.logHandlerInfo(request));
      debugger;

                  var textsC = request.pre.textsById;
                  if(textsC.length===0){
                      return reply(Boom.notFound("The resource does not exist."));
                  }

                  // if the "contents" html has images, they are encoded in base64; this method
                  // will decoded them (to /data/uploads/public/images) and update the <img> tag accordingly
                  // TODO: at the moment it works only with 1 image

                  utils.decodeImg(request.payload[0].contents);

                  // request.payload.forEach(function(obj){
                  //     obj["author_id"] = request.auth.credentials.id;
                  // });

                textsC.execute({
                    query: {
                        command: "select * from texts_update($1);",
                          arguments: [JSON.stringify(request.payload)]
                    },
                      reset: true 
                })
                  .then(function(updatedData){

                      // read the data that was updated (to obtain the joined data)
                      return textsC.execute({
                          query: {
                              command: "select * from texts_read($1);",
                              arguments: [JSON.stringify( {id: updatedData[0].id} )]
                          },
                          reset: true
                      });

                  })
                  .then(function(){
                      // we couldn't read - something went wrong
                      if(textsC.length===0){
                          return reply(Boom.badImplementation());
                      }

                      var resp         = textsC.toJSON();
                      var transformMap = transforms.maps.texts;
                      var transform    = transforms.transformArray;

                      return reply(transform(resp, transformMap));
                  })
                  .catch(function(err){
                      return reply(Boom.badImplementation(err.message));
                  })
                  .done();

              },

              config: {

                validate: {
                    params: internals.validateIds,
                      payload: internals.validatePayloadForUpdate
                },

                  pre: [
                      pre.abortIfNotAuthenticated,
                      [pre.db.getTextsById, pre.payload.extractTags],
                  ],

                  auth: Config.get('hapi.auth'),
                description: 'Put (short description)',
                notes: 'Put (long description)',
                tags: ['api'],
              }
          });
    */
    // DELETE (one or more)
    server.route({
        method: 'DELETE',
        path: internals.resourcePath + "/{ids}",
        handler: function deleteText(request, reply) {

            internals.logStack(server, Callsite()[0]);
            return options.delete.handler(request, reply, server, options);
        },

        config: options.delete.config

    });

    // any other request will receive a 405 Error
    server.route({
        method: '*',
        path: internals.resourcePath + "/{p*}",
        handler: function(request, reply) {
            var output = Boom.methodNotAllowed('The method is not allowed for the given URI.'); // 405
            reply(output);
        }
    });

    next();
};

exports.register.attributes = {
    name: internals.resourceName,
    version: '1.0.0'
};



