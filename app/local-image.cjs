'use strict';
const fs=require('fs');
// The renderer supplies no path. Only an explicit native file selection can be read.
function createImagePicker({dialog,nativeImage,getMainWindow}) {
 let busy=false;
 return async function(event) {
  const win=getMainWindow();
  if(!win || win.isDestroyed() || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)
   return {ok:false,error:'不允许的图片来源'};
  if(busy)return {ok:false,error:'图片选择处理中'};
  busy=true;
  try {
   const r=await dialog.showOpenDialog(win,{title:'选择产品图片（仅保存在本机）',properties:['openFile'],filters:[{name:'PNG / JPEG 图片',extensions:['png','jpg','jpeg']}]});
   if(r.canceled || !r.filePaths.length)return {ok:false,canceled:true};
   const file=r.filePaths[0],stat=fs.statSync(file);
   if(!stat.isFile() || stat.size>8*1024*1024)throw Error('图片须小于8MB');
   const data=fs.readFileSync(file);
   if(!(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (data[0]===255 && data[1]===216)))throw Error('请选择有效的PNG或JPEG图片');
   let image=nativeImage.createFromBuffer(data);
   if(image.isEmpty())throw Error('图片无法解码');
   const {width,height}=image.getSize();
   if(width*height>36000000)throw Error('图片像素过大，请先缩小');
   if(Math.max(width,height)>1000)image=image.resize(width>=height?{width:1000}:{height:1000});
   const jpeg=image.toJPEG(85);
   if(jpeg.length>750000)throw Error('图片压缩后仍过大，请选择更简单的图片');
   return {ok:true,imageData:'data:image/jpeg;base64,'+jpeg.toString('base64')};
  } catch(e){return {ok:false,error:e.message};}
  finally {busy=false;}
 };
}
module.exports={createImagePicker};
