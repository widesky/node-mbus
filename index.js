/* jshint -W097 */
// jshint strict:true
/*jslint node: true */
/*jslint esversion: 6 */
'use strict';

const mbusBinding = require('bindings')('mbus');
const xmlParser = require('xml2js');

class MbusMaster {
    constructor(options) {
        this.options = options || {};
        this.mbusMaster = new mbusBinding.MbusMaster();
    }

    connect(callback) {
        if (this.mbusMaster.connected && this.mbusMaster.communicationInProgress) {
            if (callback) {
                callback(new Error('Communication already in progress'));
            }
            return false;
        }
        if (this.mbusMaster.connected) {
            if (callback) {
                callback(null);
            }
            return true;
        }
        if (this.options.host && this.options.port) {
            if (!this.options.timeout) this.options.timeout = 0;
            if (this.mbusMaster.openTCP(this.options.host, this.options.port, this.options.timeout/1000)) {
                if (callback) {
                    callback(null);
                }
                return true;
            }
            else {
                if (callback) {
                    callback(new Error('No connection possible to MBus Host ' + this.options.host + ':' + this.options.port));
                }
                return false;
            }
        }
        else if (this.options.serialPort) {
            const baudRate = this.options.serialBaudRate || 0;
            if (this.mbusMaster.openSerial(this.options.serialPort, baudRate)) {
                if (callback) {
                    callback(null);
                }
                return true;
            }
            else {
                if (callback) {
                    callback(new Error('No connection possible to MBus Serial port ' + this.options.serialPort));
                }
                return false;
            }
        }
        if (callback) {
            callback(new Error('No valid connection parameter provided'));
        }
        return false;
    }

    connectAsync() {
        return new Promise((resolve, reject) => {
            this.connect((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    close(callback, wait) {
        if (wait === undefined) {
            wait = !!callback;
        }
        if (wait && !callback) wait = false;
        if (this.mbusMaster.connected && this.mbusMaster.communicationInProgress) {
            if (!wait) {
                if (callback) {
                    callback(new Error('Communication still in progress.'));
                }
                return false;
            }
            setTimeout(() => {
                this.close(callback, wait);
            }, 500);
            return undefined;
        }
        if (!this.mbusMaster.connected) {
            if (callback) {
                callback(null);
            }
            return true;
        }

        if (this.mbusMaster.close()) {
            if (callback) {
                callback(null);
            }
            return true;
        }
        else {
            if (callback) {
                callback(new Error('Close unsuccessful'));
            }
            return false;
        }
    }

    closeAsync() {
        return new Promise((resolve, reject) => {
            this.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    getData(address, options, callback) {
        // default options
        // pingFirst: Work-around buggy behaviour with some M-Bus devices,
        //            notably Sontex Supercal531
        //            https://github.com/rscada/libmbus/pull/95
        let pingFirst = true;

        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        if (options) {
            // de-structure
            ({pingFirst} = options);
        }

        if (!this.mbusMaster.connected && !this.options.autoConnect) {
            if (callback) callback(new Error('Not connected and autoConnect is false'));
            return;
        }

        this.connect((err) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            this.mbusMaster.get(address, pingFirst, (err, data) => {
                if (!err && data) {
                    //data = JSON.parse(data).MBusData;
                    const parserOpt = {
                        explicitArray: false,
                        mergeAttrs: true,
                        valueProcessors: [xmlParser.processors.parseNumbers],
                        attrValueProcessors: [xmlParser.processors.parseNumbers]
                    };
                    xmlParser.parseString(data, parserOpt, (err, result) => {
                        if (!err && result && result.MBusData) {
                            result = result.MBusData;
                            if (result.DataRecord && !Array.isArray(result.DataRecord)) {
                                result.DataRecord = [result.DataRecord];
                            }
                        }
                        if (callback) callback(err, result);
                    });
                    return;
                }
                else {
                    err = new Error(err);
                }
                if (callback) callback(err, data);
            });
        });
    }

    getDataAsync(address, options=null) {
        return new Promise((resolve, reject) => {
            this.getData(address, options, (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    scanSecondary(callback) {
        if (!this.mbusMaster.connected && !this.options.autoConnect) {
            if (callback) callback(new Error('Not connected and autoConnect is false'));
            return;
        }

        this.connect((err) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            this.mbusMaster.scan((err, data) => {
                if (!err && data !== null && data !== undefined && typeof data === 'string' ) {
                    if (data === '') {
                        data = [];
                    }
                    else {
                        try {
                            data = JSON.parse(data);
                        }
                        catch (e) {
                            err = new Error(e + ': ' + data);
                            data = null;
                        }
                    }
                }
                else {
                    err = new Error(err);
                }
                if (callback) callback(err, data);
            });
        });
    }

    scanSecondaryAsync() {
        return new Promise((resolve, reject) => {
            this.scanSecondary((err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    setPrimaryId(oldAddress, newAddress, callback) {
        if (!this.mbusMaster.connected && !this.options.autoConnect) {
            if (callback) callback(new Error('Not connected and autoConnect is false'));
            return;
        }

        this.connect((err) => {
            if (err) {
                if (callback) callback(err);
                return;
            }
            this.mbusMaster.setPrimaryId(oldAddress, newAddress, (err) => {
                if (err) {
                    err = new Error(err);
                }
                else {
                    err = null;
                }
                if (callback) callback(err);
            });
        });
    }

    setPrimaryIdAsync(oldAddress, newAddress) {
        return new Promise((resolve, reject) => {
            this.setPrimaryId(oldAddress, newAddress, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}

module.exports = MbusMaster;
