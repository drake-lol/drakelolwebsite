let img=new Image(),d=1.5,defaultImage='assets/bgimg/full_blue_square_512.png',state="",c,x,w,h,R,C,I,qW,qH,frame,user;let averageColor="#000000";let dominantColor="#000000";img.crossOrigin="Anonymous";img.src=defaultImage;const O=(r,c,q,f)=>{const v=f?.3:.2,m=f?.6:.8,s=m+Math.random()*2*v;return{x:c*(w/d)+(q%2)*qW,y:r*(h/d)+~~(q/2)*qH,r:360*Math.random(),rS:(Math.random()-.5)*.25,s,S:w*s,H:h*s,B:c*(w/d),Y:r*(h/d),q,f}};const G=()=>{document.documentElement.style.setProperty("--g",`${document.querySelector(".b-c").getBoundingClientRect().bottom+25}px`);document.querySelector(".g").classList.add("i")};const init=()=>{if(!c){c=document.getElementById("c");x=c.getContext("2d");const o=window.devicePixelRatio||1;c.width=innerWidth*o;c.height=innerHeight*o;x.scale(o,o)}w=img.width,h=img.height,C=Math.ceil(c.width/2/(w/d)),R=Math.ceil(c.height/2/(h/d)),qW=C*(w/d),qH=R*(h/d),I=[];for(let e=0;e<4;e++)for(let t=0;t<R;t++)for(let n=0;n<C;n++)I.push(O(t,n,e)),Math.random()<.3&&I.push(O(t,n,e,!0));I.sort((e,t)=>e.f-t.f);G();calculateColors();updateThemeAndFavicon();draw()};const draw=()=>{cancelAnimationFrame(frame);I=I.filter(t=>(t.r+=t.rS,t.x=t.B+(t.q%2)*qW,t.y=t.Y+~~(t.q/2)*qH,!(t.x+t.S<-2*innerWidth||t.y+t.H<-2*innerHeight||t.x>3*innerWidth||t.y>3*innerHeight)));for(let e=0;e<4;e++)for(let t=0;t<R;t++)for(let n=0;n<C;n++)if((e%2==0&&I.every(i=>Math.abs(i.x-(n*(w/d)))>w))||(e%2!=0&&I.every(i=>Math.abs(i.x-((C+n)*(w/d)))>w)))if(e<2){if(I.every(i=>Math.abs(i.y-(t*(h/d)))>h))I.push(O(t,n,e))}else{if(I.every(i=>Math.abs(i.y-((R+t)*(h/d)))>h))I.push(O(t,n,e))}I.sort((e,t)=>e.f-t.f);x.clearRect(0,0,c.width,c.height);x.save();x.beginPath();x.rect(0,0,c.width,c.height);x.clip();I.forEach(e=>(x.save(),x.translate(e.x,e.y),x.rotate(e.r*Math.PI/180),x.scale(e.s,e.s),x.drawImage(img,-w/2,-h/2,w,h),x.restore()));x.restore();frame=requestAnimationFrame(draw)};const lastFmButton=document.getElementById('lastfm-button'),lastFmApiUrl='https://lastfm-red-surf-3b97.damp-unit-21f3.workers.dev/';const calculateColors=()=>{const tempCanvas=document.createElement("canvas");const tempCtx=tempCanvas.getContext("2d");tempCanvas.width=img.width;tempCanvas.height=img.height;tempCtx.drawImage(img,0,0,img.width,img.height);const imageData=tempCtx.getImageData(0,0,img.width,img.height).data;let totalR=0,totalG=0,totalB=0;const colorCounts={};for(let i=0;i<imageData.length;i+=4){const r=imageData[i];const g=imageData[i+1];const b=imageData[i+2];totalR+=r;totalG+=g;totalB+=b;const hex=`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;colorCounts[hex]=(colorCounts[hex]||0)+1}const pixelCount=img.width*img.height;const avgR=Math.round(totalR/pixelCount);const avgG=Math.round(totalG/pixelCount);const avgB=Math.round(totalB/pixelCount);averageColor=`#${avgR.toString(16).padStart(2,'0')}${avgG.toString(16).padStart(2,'0')}${avgB.toString(16).padStart(2,'0')}`;let maxCount=0;for(const hex in colorCounts){if(colorCounts[hex]>maxCount){maxCount=colorCounts[hex];dominantColor=hex}}};const updateThemeAndFavicon=()=>{document.querySelector('meta[name="theme-color"]').setAttribute("content",averageColor);const faviconCanvas=document.createElement('canvas');faviconCanvas.width=32;faviconCanvas.height=32;const faviconCtx=faviconCanvas.getContext('2d');faviconCtx.drawImage(img,0,0,32,32);const faviconLink=document.querySelector('link[rel="icon"]');faviconLink.type='image/png';faviconLink.href=faviconCanvas.toDataURL('image/png')};const updateLastFm=async()=>{try{const e=await fetch(lastFmApiUrl);if(!e.ok)throw new Error(`HTTP error! status: ${e.status}`);const t=await e.json();const isPlaying=t.recenttracks?.track?.[0]?.["@attr"]?.nowplaying==="true";user=t.recenttracks?.["@attr"]?.user||user;if(isPlaying){const track=t.recenttracks.track[0];lastFmButton.textContent=`Listening to ${track.name} by ${track.artist["#text"]}`;lastFmButton.href=track.url||`https://last.fm/user/${user}`;let imageUrl=track.image[track.image.length-1]["#text"]||defaultImage;if(imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f"))imageUrl=defaultImage;if(imageUrl!==img.src){img.onload=init;img.src=imageUrl}state=isPlaying}else{lastFmButton.textContent="Last.fm";lastFmButton.href=user?`https://www.last.fm/user/${user}`:"#";if(state!=="Last.fm"){img.onload=init;img.src=defaultImage;state="Last.fm"}}}catch(error){console.error("Error fetching Last.fm data:",error);lastFmButton.textContent="Last.fm";lastFmButton.href="#";if(state!=="Error"){img.onload=init;img.src=defaultImage;state="Error"}}};updateLastFm();setInterval(updateLastFm,10000);document.querySelectorAll('.b').forEach(e=>e.addEventListener('contextmenu',e=>e.preventDefault()));window.addEventListener('resize',G);