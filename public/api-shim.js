(()=>{
  const ENGINE='https://pump-lab-live.onrender.com';
  const UI='https://pump-lab-ui.onrender.com';
  window.PUMP_LAB_API_ORIGIN=ENGINE;
  window.PUMP_LAB_UI_ORIGIN=UI;
  const nativeFetch=window.fetch.bind(window);

  const apiPath=input=>{
    if(typeof input==='string'&&input.startsWith('/api/'))return input;
    if(input instanceof Request){
      try{const u=new URL(input.url,location.href);return u.origin===location.origin&&u.pathname.startsWith('/api/')?u.pathname+u.search:null}catch{return null}
    }
    return null;
  };
  const fetchUrl=(origin,path,init)=>nativeFetch(origin+path,init).then(r=>{
    if(!r.ok)throw Object.assign(new Error(path+' HTTP '+r.status),{response:r});
    return r;
  });
  const hedge=async(path,init)=>{
    const secondary=new Promise((resolve,reject)=>setTimeout(()=>fetchUrl(UI,path,init).then(resolve,reject),900));
    try{return await Promise.any([fetchUrl(ENGINE,path,init),secondary])}
    catch(e){
      const errs=e?.errors||[];
      const response=errs.map(x=>x?.response).find(Boolean);
      if(response)return response;
      throw errs[0]||e;
    }
  };

  window.fetch=(input,init)=>{
    const path=apiPath(input);
    if(!path)return nativeFetch(input,init);
    if(path.startsWith('/api/state'))return hedge(path,init);
    if(path.startsWith('/api/x-feed')){
      return fetchUrl(ENGINE,path,init).catch(()=>nativeFetch(UI+path,init));
    }
    return nativeFetch(ENGINE+path,init);
  };

  const NativeEventSource=window.EventSource;
  window.EventSource=class PumpLabEventSource extends NativeEventSource{
    constructor(url,config){
      const target=typeof url==='string'&&url.startsWith('/api/')?ENGINE+url:url;
      super(target,config);
    }
  };
})();