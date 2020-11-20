/**
 * Create a new property
 * @param {org.Reliance.trackingasset.accelerationreading} tx
 * @transaction
 */
async function accelerationreading(tx){
  const factory = getFactory();
  const existingShipment = await getAssetRegistry('org.Reliance.trackingasset.ShipmentAsset');
  let updateShipment = tx.shipmentTrans;  
  try{
    let exist = await existingShipment.get(updateShipment.shipmentId);
  }catch(err){
    throw new Error('Shipment Does Not Exist');
  }  
  //caluculating the acceleration as average of the all 3 values
  let acceleration = (tx.accelX + tx.accelY + tx.accelZ)/3 +'';
  updateShipment.accReadings.push(acceleration);  
  //update the shipment
  await existingShipment.update(updateShipment);
  
  //update the time for event value and call the event
  if(acceleration > updateShipment.contract.maxAccel){
    try{
     tx.now.length;
   }catch(err){
     tx.now = new Date().toLocaleTimeString();
   }
  const placeOrderEvent = factory.newEvent('org.Reliance.trackingasset', 'accelarationthreshold');
   placeOrderEvent.accelX = tx.accelX;
   placeOrderEvent.accelY = tx.accelY;
   placeOrderEvent.accelZ = tx.accelZ;
   placeOrderEvent.message = 'Acceleration has exceeeded the limit set';
   placeOrderEvent.latitude = tx.latitude;
   placeOrderEvent.longitude = tx.longitude;
   placeOrderEvent.now = tx.now;
   placeOrderEvent.shipmentAccelThres = tx.shipmentTrans;
   emit(placeOrderEvent);
 }

}


/**
 * Create a new property
 * @param {org.Reliance.trackingasset.temparaturereading} tx
 * @transaction
 */
async function temparaturereading(tx){
  const factory = getFactory();
  const existingShipment = await getAssetRegistry('org.Reliance.trackingasset.ShipmentAsset');
  let updateShipment = tx.shipmentTrans;
  //validation of shipment exist or not
  try{
    let exist = await existingShipment.get(updateShipment.shipmentId);
  }catch(err){
    throw new Error('Shipment Does Not Exist');
  }
  //updating temp to array
  updateShipment.tempReadings.push(tx.temp+'');
  await existingShipment.update(updateShipment);

  //checking if the temp is in limit. else trigger the event
  if(tx.temp > updateShipment.contract.maxTemp || tx.temp < updateShipment.contract.minTemp){
   try{
     tx.now.length;
   }catch(err){
     tx.now = new Date().toLocaleTimeString();
   }
   const placeOrderEvent = factory.newEvent('org.Reliance.trackingasset', 'temparaturethreshold');
   placeOrderEvent.temp = tx.temp;
   placeOrderEvent.message = 'Temparature has exceeeded the limit set';
   placeOrderEvent.latitude = tx.latitude;
   placeOrderEvent.longitude = tx.longitude;
   placeOrderEvent.now = tx.now;
   placeOrderEvent.shipmentTempThres = tx.shipmentTrans;
   emit(placeOrderEvent);
  }
}


/**
 * Create a new property
 * @param {org.Reliance.trackingasset.gpsreading} tx
 * @transaction
 */
async function gpsreading(tx){
  const factory = getFactory();
  const existingShipment = await getAssetRegistry('org.Reliance.trackingasset.ShipmentAsset');
  let updateShipment = tx.shipmentTrans;
  try{
    let exist = await existingShipment.get(updateShipment.shipmentId);
  }catch(err){
    throw new Error('Shipment Does Not Exist');
  }
  //storing the gps as a single value to be stored
  let gpsLoc = tx.latitude +''+tx.latDir+''+tx.longitude+''+tx.longDir;
  updateShipment.gpsReadings.push(gpsLoc);
  await existingShipment.update(updateShipment);
  
  //calling the event based on condition
  if(gpsLoc.indexOf(updateShipment.contract.importer.address) > -1){
   const placeOrderEvent = factory.newEvent('org.Reliance.trackingasset', 'shipmentPort');
   placeOrderEvent.message = 'Package has reached the destination';
   placeOrderEvent.shipmentPort = tx.shipmentTrans;
   emit(placeOrderEvent);
 }
}



/**
 * Create a new property
 * @param {org.Reliance.trackingasset.shipmentreceived} tx
 * @transaction
 */
async function shipmentreceived(tx){
  const factory = getFactory();
  const existingShipment = await getAssetRegistry('org.Reliance.trackingasset.ShipmentAsset');
  let updateShipment = tx.shipmentReceived;
  let contract = updateShipment.contract;
  
  //calculatng the payout
  let calCount = updateShipment.unitCount * contract.unitPrice;
  let totalPayout = calCount;
  //updating the status to arrived
  updateShipment.shipmentstatus = "Arrived";
  
  //calculate the penality factor and value for all the acceleration readings
  let penality = (contract.minPenalityFact+contract.maxPenalityFact)/2;
  for(var i =0 ; i< updateShipment.accReadings.length ;i++){
    if(updateShipment.accReadings[i] > contract.maxAccel)
      totalPayout = totalPayout - (totalPayout * penality /updateShipment.unitCount);
  }
  //calculate the penality for all the temperature readings
  for(var i =0 ; i< updateShipment.tempReadings.length ;i++){
    if(updateShipment.tempReadings[i] > contract.maxTemp || updateShipment.tempReadings[i] < contract.maxTemp)
      totalPayout = totalPayout - (totalPayout * penality /updateShipment.unitCount);
  }
  
  //If the shipment is late as per the contract, set the payout to 0.
  let nowTime = new Date().toLocaleTimeString();
  throw new Error(nowTime +"::::"+contract.arrivalTime);
  if(contract.arrivalTime > nowTime){
    totalPayout = 0;
    //obviously shipper wont work for free, he needs to paid. importer gets the items for free.
    contract.shipper.balance = contract.shipper.balance + calCount/2;  
    contract.exporter.balance = contract.exporter.balance - calCount/2;
  }else{
    //calculating balance for all the 3 participants and updating them as per payout which is a illogical statement given.
    contract.exporter.balance = contract.exporter.balance + totalPayout/2;
    contract.importer.balance = contract.importer.balance - totalPayout;
    contract.shipper.balance = contract.shipper.balance + totalPayout/2;
  }
  
  const Importer = await getParticipantRegistry('org.Reliance.trackingasset.Importer');
  const Exporter = await getParticipantRegistry('org.Reliance.trackingasset.Exporter');
  const Shipper = await getParticipantRegistry('org.Reliance.trackingasset.Shipper');
  
  await Exporter.update(contract.exporter);
  await Shipper.update(contract.shipper);
  await Importer.update(contract.importer);
  
  await existingShipment.update(updateShipment);
}
