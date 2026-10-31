/* XOXO Avenue: translate the dynamic username cooldown notice in all supported languages. */
(function(){
  'use strict';
  var translations = {
    es:function(n){return 'Puedes volver a cambiar tu nombre de usuario en '+n+' '+(n===1?'día.':'días.');},
    'pt-br':function(n){return 'Você poderá alterar seu nome de usuário novamente em '+n+' '+(n===1?'dia.':'dias.');},
    de:function(n){return 'Du kannst deinen Benutzernamen in '+n+' '+(n===1?'Tag':'Tagen')+' wieder ändern.';},
    nb:function(n){return 'Du kan endre brukernavnet ditt igjen om '+n+' '+(n===1?'dag.':'dager.');},
    pl:function(n){return 'Będziesz móc ponownie zmienić nazwę użytkownika za '+n+' dni.';},
    fr:function(n){return 'Vous pourrez à nouveau modifier votre nom d’utilisateur dans '+n+' '+(n===1?'jour.':'jours.');},
    cs:function(n){return 'Uživatelské jméno budete moci znovu změnit za '+n+' '+(n===1?'den.':(n>=2&&n<=4?'dny.':'dní.'));},
    sv:function(n){return 'Du kan ändra ditt användarnamn igen om '+n+' '+(n===1?'dag.':'dagar.');},
    it:function(n){return 'Potrai modificare di nuovo il tuo nome utente tra '+n+' '+(n===1?'giorno.':'giorni.');}
  };
  function lang(){
    try{var saved=localStorage.getItem('friendhub_language');if(saved)return saved.toLowerCase();}catch(e){}
    return String(document.documentElement.lang||'en').toLowerCase();
  }
  function translate(node){
    if(!node||node.nodeType!==3||!node.nodeValue)return;
    var match=node.nodeValue.trim().match(/^You can change your username again in (\d+) days?\.$/);
    if(!match)return;
    var fn=translations[lang()];
    if(fn)node.nodeValue=node.nodeValue.replace(match[0],fn(Number(match[1])));
  }
  function scan(root){
    if(!root)return;
    if(root.nodeType===3){translate(root);return;}
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
    if(root.nodeType===1&&root.closest&&root.closest('script,style,textarea,code,pre,[translate="no"],.notranslate'))return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[],n;
    while((n=walker.nextNode()))nodes.push(n);
    nodes.forEach(translate);
  }
  function start(){
    if(!document.body)return;
    scan(document.body);
    new MutationObserver(function(records){
      records.forEach(function(r){
        if(r.type==='characterData')translate(r.target);
        else r.addedNodes.forEach(scan);
      });
    }).observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();