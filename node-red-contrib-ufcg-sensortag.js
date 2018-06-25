module.exports = function (RED) {
	"use strict";

	var noble = require('noble');
	var os = require('os');

	var TIME_INTERVAL = 2000;

	var SENSORTAG_HUMIDITY_SERVICE 	= "f000aa2004514000b000000000000000";
	var SENSORTAG_HUMIDITY_DATA 	= "f000aa2104514000b000000000000000";
	var SENSORTAG_HUMIDITY_CONFIG 	= "f000aa2204514000b000000000000000";
	var SENSORTAG_HUMIDITY_PERIOD 	= "f000aa2304514000b000000000000000";

	var SensorTag;

	function NobleScan(n) {
		// Create a RED node
		RED.nodes.createNode(this, n);


		this.duplicates = n.duplicates;
		this.uuids = [];
		this.periodicFuncId = null;
		
		if (n.uuids != undefined && n.uuids !== "") {
			this.uuids = n.uuids.split(',');    //obtain array of uuids
		}

		var node = this;
		var machineId = os.hostname();
		var scanning = false;

		noble.on('stateChange', function (state) {
			if (state === 'poweredOn') {
				noble.startScanning(node.uuids, node.duplicates, function () {
					node.log("Scanning for BLEs started. UUIDs: " + node.uuids + " - Duplicates allowed: " + node.duplicates);
					node.status({ fill: "green", shape: "dot", text: "started" });
					node.scanning = true;
				});
			} else {
				if (node.scanning) {
					noble.stopScanning(function () {
						node.log('BLE scanning stopped.');
						node.status({ fill: "red", shape: "ring", text: "stopped" });
						node.scanning = false;
					});
				}
			}
		});

		noble.on('discover', function (peripheral) {

			var msg = { payload: { peripheralUuid: peripheral.uuid, localName: peripheral.advertisement.localName } };
			msg.peripheralUuid = peripheral.uuid;
			msg.localName = peripheral.advertisement.localName;
			msg.detectedAt = new Date().getTime();
			msg.detectedBy = machineId;
			msg.advertisement = peripheral.advertisement;
			msg.rssi = peripheral.rssi;

			// Generate output event
			node.send(msg);

			if (peripheral.advertisement.localName === 'SensorTag' || peripheral.uuid === 'bc6a29ac47f2') {
				//noble.stopScanning();

				SensorTag = peripheral;
				this.periodicFuncId = setInterval(exploreCC2541, TIME_INTERVAL);
				//exploreCC2541(peripheral);
			}

			if (peripheral.advertisement.localName === 'CC2650 SensorTag' || peripheral.uuid === 'b0b448bf9681') {
				//noble.stopScanning();

				SensorTag = peripheral;
				this.periodicFuncId = setInterval(exploreCC2650, TIME_INTERVAL);
				//exploreCC2650(peripheral);
			}


		});

		function exploreCC2541(peripheral) {

			peripheral = SensorTag;

			peripheral.on('disconnect', function () {
				process.exit(0);
			});

			peripheral.connect(function (error) {
				var msg = { payload: { peripheral } };
				node.send(msg);
				peripheral.discoverServices([SENSORTAG_HUMIDITY_SERVICE], function (error, services) {

					services[0].discoverCharacteristics([SENSORTAG_HUMIDITY_DATA, SENSORTAG_HUMIDITY_CONFIG], function (error, characteristics) {
						var sensortagHumidityData = characteristics[0];
						var sensortagHumidityConfig = characteristics[1];


						sensortagHumidityData.read(function (error, data) {
							// data is a buffer
							var dataTemp;
							var dataHumidity;
							var rawTemp = data.readUInt16LE(0);
							var rawHum = data.readUInt16LE(2);
							var msgem = { payload: { } };
							
							dataTemp = (rawTemp / 65536) * 165 - 40;
							dataTemp = (rawTemp / 65536) * 165 - 40;
							rawHum &= ~0x0003; // remove status bits
							dataHumidity = (rawHum / 65536) * 100;

							//msg.payload = "Temperature " + dataTemp.toFixed(1) + "ºC" + "\n  Humidity " + dataHumidity.toFixed(1) + "%";
							msg.payload = "{\"rt\":[\"oic.r.temperature\"], \"id\":\"unique_example_idT\", \"temperature\": "+ dataTemp.toFixed(1) +",\"units\":\"C\" }";
							msgem.payload = "{\"rt\":[\"oic.r.humidity\"], \"id\":\"unique_example_idH\", \"humidity\": "+ dataHumidity.toFixed(1)+"}";
							node.send([msgem,msg]);

						});

						sensortagHumidityConfig.read(function (error, data) {
							// data is a buffer
							var dataConfig = data.readUInt8(0);

							if (dataConfig === 0) {
								sensortagHumidityConfig.write(new Buffer([0x01]), true, function (error) {

								});
							}
						});

					});

				});

			});


		}

		function exploreCC2650(peripheral) {

			peripheral = SensorTag;

			peripheral.on('disconnect', function () {
				process.exit(0);
			});

			peripheral.connect(function (error) {
				var msg = { payload: { peripheral } };
				//node.send(msg);
				peripheral.discoverServices([SENSORTAG_HUMIDITY_SERVICE], function (error, services) {

					services[0].discoverCharacteristics([SENSORTAG_HUMIDITY_DATA, SENSORTAG_HUMIDITY_CONFIG, SENSORTAG_HUMIDITY_PERIOD], function (error, characteristics) {
						var sensortagHumidityData = characteristics[0];
						var sensortagHumidityConfig = characteristics[1];
						var sensortagHumidityPeriod = characteristics[2];
		
						sensortagHumidityData.read(function (error, data) {
							// data is a buffer
							var dataTemp;
							var dataHumidity;
							var rawTemp = data.readUInt16LE(0);
							var rawHum = data.readUInt16LE(2);
		
							dataTemp = (rawTemp / 65536) * 165 - 40;
							rawHum &= ~0x0003; // remove status bits
							dataHumidity = (rawHum / 65536) * 100;
							//msg.payload = "{\"rt\":[\"oic.r.temperature\"], \"id\":\"unique_example_id\", \"temperature\":  "+ dataTemp.toFixed(1) +",\"units\":\"C\" }"+
							//"{\"rt\":[\"oic.r.humidity\"], \"id\":\"unique_example_id1\", \"humidity\":  "+ dataHumidity.toFixed(1)+"}";
 
						//	msg.payload = "Temperature " + dataTemp.toFixed(1) + "ºC" + "\n  Humidity " + dataHumidity.toFixed(1) + "%";
							msg.payload = "{\"rt\":[\"oic.r.temperature\"], \"id\":\"unique_example_idT\", \"temperature\": "+ dataTemp.toFixed(1) +",\"units\":\"C\" }";
							msgem.payload = "{\"rt\":[\"oic.r.humidity\"], \"id\":\"unique_example_idH\", \"humidity\": "+ dataHumidity.toFixed(1)+"}";
							node.send([msgem,msg]);
							

						});

						sensortagHumidityConfig.read(function (error, data) {
							// data is a buffer
							var dataConfig = data.readUInt8(0);

							if (dataConfig === 0) {
								sensortagHumidityConfig.write(new Buffer([0x01]), true, function (error) {

								});
							}
						});

						sensortagHumidityPeriod.read(function (error, data) {
							// data is a buffer
							var dataPeriod = data.readUInt8(0);
						});

					});

				});

			});


		}


	}

	RED.nodes.registerType("SensorTag", NobleScan);

	NobleScan.prototype.close = function() {
        if (this.interval_id != null) {
            clearInterval(this.periodicFuncId);
            if (RED.settings.verbose) { this.log(RED._("SensorTag.stopped")); }
        } 
	};
	
}