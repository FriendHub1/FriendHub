/* XOXO Seasonal Themes 💜 — automatic local-calendar theme, no account data or network calls. */
(function(){
  "use strict";
  var copy={
    halloween:{icon:"🎃",names:{es:"Noche mágica",en:"Halloween Magic","pt-br":"Magia de Halloween",de:"Halloween-Zauber",nb:"Halloween-magi",pl:"Magia Halloween",fr:"Magie d’Halloween",cs:"Halloween kouzlo",sv:"Halloweenmagi",it:"Magia di Halloween"}},
    autumn:{icon:"🍂",names:{es:"Otoño mágico",en:"Autumn Magic","pt-br":"Magia de outono",de:"Herbstzauber",nb:"Høstmagi",pl:"Jesienna magia",fr:"Magie d’automne",cs:"Podzimní kouzlo",sv:"Höstmagi",it:"Magia d’autunno"}},
    winter:{icon:"❄️",names:{es:"Invierno brillante",en:"Winter Glow","pt-br":"Brilho de inverno",de:"Winterzauber",nb:"Vinterglød",pl:"Zimowy blask",fr:"Éclat d’hiver",cs:"Zimní záře",sv:"Vinterglöd",it:"Magia d’inverno"}},
    love:{icon:"💘",names:{es:"Love Season",en:"Love Season","pt-br":"Temporada do amor",de:"Zeit der Liebe",nb:"Kjærlighetssesong",pl:"Sezon miłości",fr:"Saison de l’amour",cs:"Čas lásky",sv:"Kärlekssäsong",it:"Stagione dell’amore"}},
    spring:{icon:"🌸",names:{es:"Primavera en flor",en:"Spring Bloom","pt-br":"Primavera em flor",de:"Frühlingsblüte",nb:"Vårblomstring",pl:"Wiosenne kwitnienie",fr:"Printemps en fleurs",cs:"Jarní květ",sv:"Vårblomning",it:"Primavera in fiore"}},
    summer:{icon:"☀️",names:{es:"Summer Crush",en:"Summer Crush","pt-br":"Paixão de verão",de:"Sommerflirt",nb:"Sommerflørt",pl:"Letni flirt",fr:"Flirt d’été",cs:"Letní flirt",sv:"Sommarflirt",it:"Flirt estivo"}},
    pride:{icon:"🏳️‍🌈",names:{es:"Love is Love",en:"Love is Love","pt-br":"Amor é amor",de:"Liebe ist Liebe",nb:"Kjærlighet er kjærlighet",pl:"Miłość to miłość",fr:"L’amour, c’est l’amour",cs:"Láska je láska",sv:"Kärlek är kärlek",it:"L’amore è amore"}},
    newyear:{icon:"✨",names:{es:"Feliz Año Nuevo",en:"Happy New Year","pt-br":"Feliz Ano Novo",de:"Frohes neues Jahr",nb:"Godt nytt år",pl:"Szczęśliwego Nowego Roku",fr:"Bonne année",cs:"Šťastný nový rok",sv:"Gott nytt år",it:"Felice anno nuovo"}}
  };
  function language(){
    var raw="";
    try{raw=new URL(location.href).searchParams.get("lang")||localStorage.getItem("friendhub_language")||"";}catch(_){}
    raw=(raw||document.documentElement.lang||"en").toLowerCase().replace(/_/g,"-");
    if(raw==="pt"||raw.indexOf("pt-")===0)return "pt-br";
    if(raw==="no"||raw==="nb"||raw.indexOf("nb-")===0)return "nb";
    var key=raw.split("-")[0];
    return copy.autumn.names[key]!==undefined?key:"en";
  }
  function currentTheme(date){
    var m=date.getMonth()+1,d=date.getDate();
    if(m===1&&d<=2)return "newyear";
    if(m===6)return "pride";
    if(m===10&&d>=15)return "halloween";
    if(m===10||m===11)return "autumn";
    if(m===12||m===1)return "winter";
    if(m===2)return "love";
    if(m>=3&&m<=5)return "spring";
    return "summer";
  }
  function apply(){
    if(!document.body)return;
    var key=currentTheme(new Date()),item=copy[key],lang=language();
    document.body.setAttribute("data-xoxo-season",key);
    var badge=document.getElementById("xoxo-seasonal-theme-badge");
    if(!badge){badge=document.createElement("div");badge.id="xoxo-seasonal-theme-badge";badge.setAttribute("aria-label","XOXO Avenue seasonal theme");badge.setAttribute("role","note");document.body.appendChild(badge);}
    badge.innerHTML='<span class="xoxo-season-icon" aria-hidden="true"></span><span class="xoxo-season-label"></span>';
    badge.querySelector(".xoxo-season-icon").textContent=item.icon;
    badge.querySelector(".xoxo-season-label").textContent=item.names[lang]||item.names.en;
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
})();
