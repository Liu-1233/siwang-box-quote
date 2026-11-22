(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SBProductSpecs=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const types={woven:'编织网 / 卷网',welded:'电焊网片',fence:'护栏网 / 隔离栅',horse:'马场围栏',privacy:'隐私围挡 / 私人围栏',general:'其他 / 配件'};
  const fields={
    panelLength:['网片 / 围栏单元长度','mm'],panelHeight:['网片 / 围栏高度','mm'],wireDiameter:['丝径','mm'],openingWidth:['孔宽','mm'],openingHeight:['孔高','mm'],
    panelThickness:['网片 / 板材壁厚','mm'],postHeight:['立柱总高度','mm'],postWidth:['立柱截面宽 / 直径','mm'],postDepth:['立柱截面深','mm'],postThickness:['立柱壁厚','mm'],
    railWidth:['横梁宽','mm'],railHeight:['横梁高','mm'],railThickness:['横梁壁厚','mm'],railCount:['横梁数量','根'],embedDepth:['预埋深度','mm'],
    frameWidth:['边框截面宽','mm'],frameThickness:['边框壁厚','mm'],picketWidth:['竖条 / 隐私板宽','mm'],picketThickness:['竖条 / 隐私板壁厚','mm']
  };
  const units={mm:1,cm:10,m:1000,ft:304.8,in:25.4};
  function unitFor(specs,key){const u=specs&&specs.displayUnits&&specs.displayUnits[key];return units[u]?u:(['panelLength','panelHeight','postHeight','embedDepth'].includes(key)?'m':'mm');}
  function displayValue(value,unit){return value==null?'':Number((value/(units[unit]||1)).toPrecision(12));}
  function validate(specs){if(specs==null)return '';if(typeof specs!=='object'||Array.isArray(specs))return '产品参数格式不正确';if(!types[specs.type])return '请选择产品类型';for(const k of Object.keys(fields)){const v=specs[k];if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1e9))return fields[k][0]+'须为大于零的有效数字，未确定请留空';if(k==='railCount'&&v!=null&&!Number.isInteger(v))return '横梁数量须为整数';}return '';}
  function normalize(value){value=value&&typeof value==='object'?value:{};const out={type:types[value.type]?value.type:'general'};for(const k of Object.keys(fields)){const n=value[k]==null||value[k]===''?null:Number(value[k]);out[k]=Number.isFinite(n)&&n>0&&n<=1e9?n:null;}out.finish=String(value.finish||'').slice(0,200);out.color=String(value.color||'').slice(0,100);out.accessories=String(value.accessories||'').slice(0,1000);out.installation=String(value.installation||'').slice(0,1000);out.displayUnits={};for(const k of Object.keys(fields))if(k!=='railCount')out.displayUnits[k]=unitFor(value,k);return out;}
  function parseTextLegacy(text){
    text=String(text||'');const s=normalize({type:/马场|马长|horse/i.test(text)?'horse':/隐私|私人|围挡|privacy/i.test(text)?'privacy':/护栏|围栏|fenc/i.test(text)?'fence':/电焊|网片/.test(text)?'welded':'general'});
    const aliases={panelLength:'网片长(?:度)?|网长|围栏长(?:度)?',panelHeight:'网片高(?:度)?|网高|围栏高(?:度)?',wireDiameter:'丝径|线径',openingWidth:'孔宽',openingHeight:'孔高',panelThickness:'网片(?:壁)?厚(?:度)?|板(?:材)?厚(?:度)?',postHeight:'立柱高(?:度)?|柱高',postWidth:'立柱(?:截面)?宽|柱宽|立柱直径',postDepth:'立柱(?:截面)?深',postThickness:'立柱(?:壁)?厚(?:度)?|柱厚',railWidth:'横梁宽',railHeight:'横梁高',railThickness:'横梁(?:壁)?厚(?:度)?',railCount:'横梁数量|横梁数',embedDepth:'预埋深(?:度)?',frameWidth:'边框宽',frameThickness:'边框(?:壁)?厚',picketWidth:'竖条宽|隐私板宽',picketThickness:'竖条厚|隐私板厚'};
    for(const k of Object.keys(aliases)){const m=text.match(new RegExp('(?:'+aliases[k]+')\\s*[:：=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(毫米|厘米|英尺|英寸|mm|cm|ft|in|米|m)?','i'));if(m){const raw=(m[2]||'mm').toLowerCase(),u=({毫米:'mm',厘米:'cm',米:'m',英尺:'ft',英寸:'in'})[raw]||raw;s[k]=Number(m[1])*(k==='railCount'?1:(units[u]||1));if(k!=='railCount')s.displayUnits[k]=u;}}
    const installation=text.match(/安装(?:方式|方法)?\s*[:：=]\s*([^\n，,；;]+)/);if(installation)s.installation=installation[1].trim().slice(0,1000);
    const hole=text.match(/(?:孔径|网孔)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)?/i);if(hole){const factor=/cm|厘米/i.test(hole[3]||'')?10:1;s.openingWidth=Number(hole[1])*factor;s.openingHeight=Number(hole[2])*factor;}
    return {nameCn:(text.split(/[\n，,；;]/)[0]||'').slice(0,100),specs:s,note:text.slice(0,4000)};
  }
  function parseText(text){
    text=String(text||'');const result=parseTextLegacy(text),s=normalize({type:result.specs.type});
    const aliases={panelLength:'网片长度|网片长|围栏长度|围栏长|板长|网长|panel length|panel width',panelHeight:'网片高度|网片高|围栏高度|围栏高|板高|网高|高度|panel height',wireDiameter:'丝径|线径|wire diameter',openingWidth:'孔宽|opening width',openingHeight:'孔高|opening height',panelThickness:'网片壁厚|网片厚度|板材厚度|板厚|panel thickness',postHeight:'立柱总高度|立柱高度|立柱高|柱高|post height',postWidth:'立柱截面宽|立柱直径|立柱宽|柱宽|post width|post diameter',postDepth:'立柱截面深|柱深|post depth',postThickness:'立柱壁厚|立柱厚度|柱厚|post thickness',railWidth:'横梁宽|rail width',railHeight:'横梁高|rail height',railThickness:'横梁壁厚|横梁厚度|rail thickness',railCount:'横梁数量|横梁数|横梁|number of rails',embedDepth:'预埋深度|埋深|embed depth',frameWidth:'边框宽|frame width',frameThickness:'边框壁厚|边框厚|frame thickness',picketWidth:'竖条宽|隐私板宽|picket width',picketThickness:'竖条厚|隐私板厚|picket thickness'};
    const unit='毫米|厘米|英尺|英寸|mm|cm|ft|in|米|m';
    for(const key of Object.keys(aliases)){
      const re=new RegExp('(?:^|[\\s，,；;：:])(?:'+aliases[key]+')\\s*[:：=]?\\s*(\\d+(?:\\.\\d+)?)\\s*('+unit+'|根)?','gi');
      let m,values=[],ambiguous=false;
      while((m=re.exec(text))){const tail=text.slice(re.lastIndex);if(/^\s*(?:[\/／~～×x*]|[-–—]\s*\d|或|至|到)/i.test(tail)){ambiguous=true;continue;}
        if(key!=='railCount'&&!m[2])continue;
        const u=({毫米:'mm',厘米:'cm',米:'m',英尺:'ft',英寸:'in'})[(m[2]||'').toLowerCase()]||(m[2]||'mm').toLowerCase();const value=Number(m[1])*(key==='railCount'?1:units[u]);
        if(value>0&&Number.isFinite(value))values.push({value,u});
      }
      if(!ambiguous&&values.length&&values.every(v=>v.value===values[0].value)){s[key]=values[0].value;if(key!=='railCount')s.displayUnits[key]=values[0].u;}
    }
    const hole=text.match(/(?:孔径|网孔|mesh opening)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)\b/i);
    if(hole&&!/^\s*[\/／~～或]/.test(text.slice(hole.index+hole[0].length))){const f=/cm|厘米/i.test(hole[3])?10:1;s.openingWidth=Number(hole[1])*f;s.openingHeight=Number(hole[2])*f;}
    for(const [key,label] of [['installation','安装方式|安装方法|installation'],['finish','表面处理|finish'],['color','颜色|color'],['accessories','配件|accessories']]){const m=text.match(new RegExp('(?:'+label+')\\s*[:：=]\\s*([^\\n，,；;]+)','i'));if(m)s[key]=m[1].trim();}
    result.specs=s;return result;
  }
  function summary(specs){if(!specs)return '';const parts=Object.keys(fields).filter(k=>specs[k]!=null).map(k=>{const u=k==='railCount'?'根':unitFor(specs,k);return fields[k][0]+' '+displayValue(specs[k],u)+' '+u;});if(specs.installation)parts.push('安装方式 '+String(specs.installation));return parts.join(' · ');}
  return {types,fields,units,unitFor,displayValue,validate,normalize,parseText,summary};
});
