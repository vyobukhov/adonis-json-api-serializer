'use strict';

const {ServiceProvider} = require('@adonisjs/fold');
const _ = require('lodash');
const GE = require('@adonisjs/generic-exceptions');
const RegistryException = require('../src/Exceptions/RegistryException');

class JsonApiProvider extends ServiceProvider {

    _registerService() {
        this.app.singleton('JsonApi/Src/Serializer', (app) => {
            return new (require('../src/Serializer'))(app.use('Adonis/Src/Config'));
        });

        this.app.singleton('JsonApi/Src/ErrorHandler', (app) => {
            return new (require('../src/ErrorHandler'))(app.use('Adonis/Src/Config'));
        });

        this.app.singleton('JsonApi/Src/RecordBrowser', () => require('../src/RecordBrowser'));

        this.app.alias('JsonApi/Src/Serializer', 'JsonApiSerializer');
        this.app.alias('JsonApi/Src/ErrorHandler', 'JsonApiErrorHandler');
        this.app.alias('JsonApi/Src/RecordBrowser', 'JsonApiRecordBrowser');
    };

    _registerSerializer() {
        this.app.bind('JsonApi/Src/Lucid/Serializer', () => require('../src/Lucid/Serializer'));
    }

    _registerMiddleware() {
        this.app.bind('JsonApi/Src/Middleware/Specification', (app) => {
            const JsonApiSpecification = require('../src/Middleware/Specification');
            return new JsonApiSpecification(app.use('Adonis/Src/Config'));
        });

        this.app.bind('JsonApi/Src/Middleware/Bind', (app) => {
            const JsonApiBind = require('../src/Middleware/JsonApiBind');
            return new JsonApiBind();
        });
    }

    register() {
        this._registerService();
        this._registerSerializer();
        this._registerMiddleware();
    }

    boot() {
        const Config = this.app.use('Adonis/Src/Config');
        const config = Config.get('jsonApi');

        if (!config || !_.size(config) === 0) {
            throw GE.RuntimeException.missingConfig('configuration for jsonApi', 'config/jsonApi.js')
        }

        const JsonApiSerializer = use('JsonApiSerializer');
        const Registry = Config.get('jsonApi.registry');
        for (const type in Registry) {
            try {
                JsonApiSerializer.register(type, Registry[type].structure);
            } catch (error) {
                throw RegistryException.invoke(type + ": " + error.message);
            }
        }

        const RouteManager = this.app.use('Adonis/Src/Route');
        const Server = this.app.use('Adonis/Src/Server');

        Server.registerNamed({jsonApiBind: 'JsonApi/Middleware/Bind'});
        Server.registerNamed({jsonApiSpec: 'JsonApi/Middleware/Specification'});

        RouteManager.Route.macro('jsonApi', (jsonType) => {
            this.middleware([`jsonApiBind:${jsonType}`, 'jsonApiSpec']);
            return this;
        });

        RouteManager.RouteResource.macro('jsonApi', (jsonsMap) => {
            const middlewareMap = new Map();

            for (const [routeNames, jsons] of jsonsMap) {
                const middleware = _.castArray(jsons).map((jsonType) => [`jsonApiBind:${jsonType}`, 'jsonApiSpec']);
                middlewareMap.set(routeNames, middleware)
            }

            this.middleware(middlewareMap);
            return this
        });

    }
}

module.exports = JsonApiProvider;

