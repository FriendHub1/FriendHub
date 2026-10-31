/* XOXO Avenue — XOXO Seasonal Magic ✨ */
(function(){
"use strict";
if(window.__xoxoSeasonalMagicLoaded)return;window.__xoxoSeasonalMagicLoaded=true;
var now=new Date(),year=now.getFullYear(),month=now.getMonth()+1,day=now.getDate();
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(y,Math.floor(n/31)-1,n%31+1);}
function sameRange(m,d,m1,d1,m2,d2){var v=m*100+d;return v>=m1*100+d1&&v<=m2*100+d2;}
var e=easter(year),em=e.getMonth()+1,ed=e.getDate(),season=null;
function easterOffset(offset){var x=new Date(year,em-1,ed+offset);return month===x.getMonth()+1&&day===x.getDate();}
if(sameRange(month,day,2,7,2,15))season="valentine";
else if(sameRange(month,day,3,14,3,18))season="stpatrick";
else if(easterOffset(-2)||easterOffset(-1)||easterOffset(0)||easterOffset(1))season="easter";
else if(sameRange(month,day,3,1,3,13))season="carnival";
else if(sameRange(month,day,3,20,5,31))season="spring";
else if(sameRange(month,day,6,21,8,31))season="summer";
else if(sameRange(month,day,10,24,11,1))season="halloween";
else if(sameRange(month,day,11,20,11,27))season="thanksgiving";
else if(sameRange(month,day,12,15,12,26))season="christmas";
else if(sameRange(month,day,12,27,12,31)||sameRange(month,day,1,1,1,2))season="newyear";
if(!season)return;
var themes={
valentine:{label:{es:"San Valentín",en:"Valentine’s Day","pt-br":"Dia dos Namorados",fr:"Saint-Valentin",pl:"Walentynki",de:"Valentinstag",nb:"Valentinsdagen",cs:"Valentýn",sv:"Alla hjärtans dag",it:"San Valentino"},emoji:["💗","💞","🌹","💕"],a:"#ff4fba",b:"#ff9acb",glow:"rgba(255,79,186,.18)"},
carnival:{label:{es:"Carnaval",en:"Carnival","pt-br":"Carnaval",fr:"Carnaval",pl:"Karnawał",de:"Karneval",nb:"Karneval",cs:"Karneval",sv:"Karneval",it:"Carnevale"},emoji:["🎭","✨","🎊","💜"],a:"#c15bff",b:"#ffc34d",glow:"rgba(193,91,255,.18)"},
stpatrick:{label:{es:"San Patricio",en:"St. Patrick’s Day","pt-br":"Dia de São Patrício",fr:"Saint-Patrick",pl:"Dzień Świętego Patryka",de:"St. Patrick’s Day",nb:"St. Patrick’s Day",cs:"Den svatého Patrika",sv:"Sankt Patricks dag",it:"San Patrizio"},emoji:["🍀","✨","💚","🌈"],a:"#43d98b",b:"#a5f36b",glow:"rgba(67,217,139,.16)"},
easter:{label:{es:"Pascua",en:"Easter","pt-br":"Páscoa",fr:"Pâques",pl:"Wielkanoc",de:"Ostern",nb:"Påske",cs:"Velikonoce",sv:"Påsk",it:"Pasqua"},emoji:["🐰","🌷","🥚","🦋"],a:"#c58aff",b:"#ffb4d5",glow:"rgba(197,138,255,.18)"},
spring:{label:{es:"Primavera",en:"Spring","pt-br":"Primavera",fr:"Printemps",pl:"Wiosna",de:"Frühling",nb:"Vår",cs:"Jaro",sv:"Vår",it:"Primavera"},emoji:["🌸","🦋","🌷","✨"],a:"#ee8fc5",b:"#a7e6c1",glow:"rgba(238,143,197,.16)"},
summer:{label:{es:"Verano",en:"Summer","pt-br":"Verão",fr:"Été",pl:"Lato",de:"Sommer",nb:"Sommer",cs:"Léto",sv:"Sommar",it:"Estate"},emoji:["☀️","🌺","🐚","🌴"],a:"#56c8ff",b:"#ffb45e",glow:"rgba(86,200,255,.16)"},
halloween:{label:{es:"Halloween",en:"Halloween","pt-br":"Halloween",fr:"Halloween",pl:"Halloween",de:"Halloween",nb:"Halloween",cs:"Halloween",sv:"Halloween",it:"Halloween"},emoji:["🎃","🦇","✨","👻"],a:"#b36cff",b:"#ff9a42",glow:"rgba(179,108,255,.2)"},
thanksgiving:{label:{es:"Día de Acción de Gracias",en:"Thanksgiving","pt-br":"Ação de Graças",fr:"Action de grâce",pl:"Święto Dziękczynienia",de:"Erntedank",nb:"Takkefest",cs:"Den díkůvzdání",sv:"Tacksägelsedagen",it:"Giorno del Ringraziamento"},emoji:["🍂","🧡","🍁","✨"],a:"#e69a4d",b:"#ffd18a",glow:"rgba(230,154,77,.16)"},
christmas:{label:{es:"Navidad",en:"Christmas","pt-br":"Natal",fr:"Noël",pl:"Boże Narodzenie",de:"Weihnachten",nb:"Jul",cs:"Vánoce",sv:"Jul",it:"Natale"},emoji:["❄️","🎄","🎁","✨"],a:"#9a8cff",b:"#e8f4ff",glow:"rgba(154,140,255,.18)"},
newyear:{label:{es:"Año Nuevo",en:"New Year","pt-br":"Ano Novo",fr:"Nouvel An",pl:"Nowy Rok",de:"Neujahr",nb:"Nyttår",cs:"Nový rok",sv:"Nyår",it:"Capodanno"},emoji:["🎆","✨","🥂","🌟"],a:"#ffd36b",b:"#c49aff",glow:"rgba(255,211,107,.18)"}
};
var t=themes[season];if(!t)return;
var lang=(localStorage.getItem("friendhub_language")||document.documentElement.lang||"en").toLowerCase().replace("_","-");if(lang.indexOf("pt")===0)lang="pt-br";else lang=lang.split("-")[0];if(!t.label[lang])lang="en";
var path=location.pathname.replace(/\/$/,""),isProfile=(/^\/[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/.test(path)&&!["about","discover","privacy","terms","guidelines","api","u","post"].includes(path.slice(1).toLowerCase()))||new URLSearchParams(location.search).has("profile");
function mount(){if(!document.body||document.getElementById("xoxo-seasonal-magic"))return;document.body.classList.add("xoxo-seasonal-active","xoxo-seasonal-"+season);if(isProfile)document.body.classList.add("xoxo-seasonal-profile");document.documentElement.style.setProperty("--xoxo-seasonal-a",t.a);document.documentElement.style.setProperty("--xoxo-seasonal-b",t.b);document.documentElement.style.setProperty("--xoxo-seasonal-glow",t.glow);
var root=document.createElement("div");root.id="xoxo-seasonal-magic";root.setAttribute("aria-hidden","true");var ribbon=document.createElement("div");ribbon.className="xoxo-seasonal-ribbon";ribbon.textContent="XOXO Seasonal Magic ✨ · "+t.label[lang];root.appendChild(ribbon);
for(var i=0;i<12;i++){var p=document.createElement("span");p.className="xoxo-seasonal-float";p.textContent=t.emoji[i%t.emoji.length];p.style.setProperty("--x",(i*8.7+3)+"vw");p.style.setProperty("--s",(13+(i%4)*6)+"px");p.style.setProperty("--d",(13+(i%5)*4)+"s");p.style.setProperty("--delay",(-1*i*1.7)+"s");p.style.setProperty("--drift",((i%2?1:-1)*(18+(i%4)*10))+"px");root.appendChild(p);}document.body.appendChild(root);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();