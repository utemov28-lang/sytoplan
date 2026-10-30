// мок Telegram WebApp для QA
(function(){ const log={back:[],hap:0,header:null}; let backCb=null; window.__tgLog=log; window.__tgBack=()=>backCb&&backCb();
 window.Telegram={WebApp:{initData:'query_id=test',version:'8.0',platform:'ios',colorScheme:'light',themeParams:{},
  isVersionAtLeast:v=>true, ready(){}, expand(){}, onEvent(){}, setHeaderColor(c){log.header=c;}, setBackgroundColor(){}, setBottomBarColor(){}, disableVerticalSwipes(){log.noSwipe=true;},
  BackButton:{show(){log.back.push(1);log.visible=true;},hide(){log.back.push(0);log.visible=false;},onClick(f){backCb=f;}},
  HapticFeedback:{selectionChanged(){log.hap++;},impactOccurred(){log.hap++;},notificationOccurred(){log.hap++;}} }};
 document.documentElement.style.setProperty('--tg-safe-area-inset-top','0px'); document.documentElement.style.setProperty('--tg-content-safe-area-inset-top','46px'); })();
