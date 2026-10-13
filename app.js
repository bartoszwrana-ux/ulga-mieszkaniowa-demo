(function () {
  'use strict';
  const core = window.HousingCalculator;
  const $ = id => document.getElementById(id);
  const fields = [...core.keys, 'totalHousing'];
  const baseKeys = core.keys.filter(key => !core.expenseKeys.includes(key));
  const categories = [
    ['propertyAcquisition','Zakup domu lub mieszkania','Kwalifikujący się zakup i związane prawa.'],
    ['cooperativeRight','Prawo spółdzielcze','Własnościowe prawo do lokalu lub domu.'],
    ['landAcquisition','Grunt pod budowę','Grunt kwalifikujący się do własnych celów mieszkaniowych.'],
    ['construction','Budowa, rozbudowa lub remont','Prace przy własnym domu lub lokalu.'],
    ['adaptation','Adaptacja na cele mieszkalne','Kwalifikująca się przebudowa lub adaptacja.'],
    ['loanRepayment','Spłata kredytu i odsetek','Kredyt spełniający warunki ulgi.'],
    ['additionalLoanRepayment','Kredyt refinansujący','Kwalifikująca się spłata kredytu refinansującego.'],
    ['subsequentLoanRepayment','Kolejny kredyt refinansujący','Kwalifikująca się spłata kolejnego kredytu.'],
    ['exchangePropertyValue','Nieruchomość otrzymana w zamian','Wartość kwalifikująca się do zwolnienia.']
  ];
  for (const [id,label,hint] of categories) {
    const field=document.createElement('div'); field.className='field';
    const labelEl=document.createElement('label'); labelEl.htmlFor=id; labelEl.textContent=label;
    const hintEl=document.createElement('p'); hintEl.id=id+'-hint'; hintEl.className='hint'; hintEl.textContent=hint;
    const wrapper=document.createElement('div'); wrapper.className='money-input';
    const input=document.createElement('input'); input.id=id; input.name=id; input.type='text'; input.inputMode='decimal'; input.autocomplete='off'; input.spellcheck=false; input.setAttribute('aria-describedby',id+'-hint '+id+'-error');
    const currency=document.createElement('span'); currency.textContent='zł'; currency.setAttribute('aria-hidden','true');
    const error=document.createElement('p'); error.className='error'; error.id=id+'-error';
    wrapper.append(input,currency); field.append(labelEl,hintEl,wrapper,error); $('category-fields').append(field);
  }
  const resultIds=['tax','saving','baseline','revenue','totalCosts','income','plannedExpenses','eligibleExpenses','taxExemptIncome','taxBase','roundedBase'];
  let detailed=false;
  let touched=false;
  let announcementTimer;
  function canonical(cents) { return (cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0'); }
  function categorySum() { return core.expenseKeys.reduce((sum,key)=>sum+core.parseMoney($(key).value),0n); }
  function formatInput(input) {
    if (!input.value.trim()) return;
    try { input.value=core.formatNumber(core.parseMoney(input.value,input.id==='saleAmount')); } catch (_) {}
    input.classList.toggle('compact',input.value.length>16);
  }
  function showErrors(errors) {
    for(const id of fields) {
      const message=errors[id]||'';
      $(id+'-error').textContent=message;
      $(id).setAttribute('aria-invalid',message?'true':'false');
    }
    if(errors.sellingCosts) $('selling-details').open=true;
    if(errors.improvements||errors.depreciation) $('cost-details').open=true;
  }
  function rawValues() {
    const raw=Object.fromEntries(baseKeys.map(key=>[key,$(key).value]));
    for(const key of core.expenseKeys) raw[key]=detailed?$(key).value:'';
    if(!detailed) raw.propertyAcquisition=$('totalHousing').value;
    return raw;
  }
  function announce(text) {
    window.clearTimeout(announcementTimer);
    announcementTimer=window.setTimeout(()=>{$('live-status').textContent=text;},350);
  }
  function render() {
    const result=core.calculate(rawValues());
    const errors={...(!result.ok?result.errors:{})};
    if(!detailed&&errors.propertyAcquisition) { errors.totalHousing=errors.propertyAcquisition; delete errors.propertyAcquisition; }
    if(!touched&&$('saleAmount').value==='') delete errors.saleAmount;
    showErrors(errors);
    const panel=document.querySelector('.result-panel'); panel.classList.toggle('invalid',!result.ok);
    $('result-state').textContent=!result.ok?'Dane do uzupełnienia':$('example').value==='custom'?'Twoje kwoty':'Przykład';
    if(!result.ok) {
      for(const id of resultIds) $(id).textContent='—';
      $('mobile-tax').textContent='—'; $('coverage').textContent='—'; $('progress-fill').style.width='0%';
      $('result-note').textContent=$('saleAmount').value===''&&!touched?'Wpisz cenę sprzedaży, aby zobaczyć wynik.':'Popraw wskazane pola. Wynik pojawi się po wpisaniu prawidłowych kwot.';
      try { $('category-total').textContent=core.formatCents(categorySum()); } catch (_) { $('category-total').textContent='—'; }
      announce('Wynik niedostępny. Uzupełnij lub popraw kwoty.'); return result;
    }
    const results={tax:result.calculatedTaxPLN*100n,saving:result.reliefPLN*100n,baseline:result.withoutReliefPLN*100n,revenue:result.revenue,totalCosts:result.totalCosts,income:result.income,plannedExpenses:result.plannedExpenses,eligibleExpenses:result.eligibleExpenses,taxExemptIncome:result.taxExemptIncome,taxBase:result.taxBase,roundedBase:result.roundedBasePLN*100n};
    for(const [id,cents] of Object.entries(results)) { $(id).textContent=core.formatCents(cents); $(id).classList.toggle('long',$(id).textContent.length>18); }
    $('mobile-tax').textContent=$('tax').textContent; $('mobile-tax').classList.toggle('long',$('tax').textContent.length>18);
    $('category-total').textContent=core.formatCents(result.plannedExpenses);
    const bp=result.coverageBasisPoints; const percent=(bp/100n).toString()+(bp%100n?'.'+(bp%100n).toString().padStart(2,'0'):'');
    $('coverage').textContent=percent+'%'; $('progress-fill').style.width=percent+'%';
    if(result.income<0n) $('result-note').textContent='Sprzedaż ze stratą. Przy tych kwotach nie ma dodatniego dochodu ani podatku do zapłaty.';
    else if(result.income===0n) $('result-note').textContent='Dochód wynosi zero. Przy tych kwotach podatek nie występuje.';
    else if(result.capped) $('result-note').textContent='Wydatki ponad przychód nie zwiększają zwolnienia. W obliczeniach uwzględniono limit do wysokości przychodu.';
    else if(result.eligibleExpenses===result.revenue) $('result-note').textContent='Wydatki pokrywają cały przychód. Cały dodatni dochód jest zwolniony, jeśli wydatki spełniają warunki ulgi.';
    else if(result.eligibleExpenses===0n) $('result-note').textContent='Bez kwalifikujących się wydatków mieszkaniowych nie ma zwolnienia z tytułu ulgi.';
    else $('result-note').textContent='Część dochodu jest zwolniona proporcjonalnie do udziału wydatków mieszkaniowych w przychodzie.';
    announce('Podatek po uldze '+$('tax').textContent+'. Oszczędność '+$('saving').textContent+'.');
    return result;
  }
  function setDetailed(next) {
    if(next===detailed) return;
    if(next) {
      const total=$('totalHousing').value;
      let match=false;
      try { match=core.parseMoney(total)===categorySum(); } catch (_) {}
      if(!match) { for(const key of core.expenseKeys) $(key).value=''; $('propertyAcquisition').value=total; }
    } else {
      for(const key of core.expenseKeys) {
        try { core.parseMoney($(key).value); }
        catch (_) { $('detailed').checked=true; render(); $(key).focus(); return; }
      }
      const sum=categorySum();
      if(sum>core.MAX_CENTS) {
        $('detailed').checked=true;
        $('result-note').textContent='Suma kategorii jest większa niż limit pojedynczego pola. Pozostaw rozpisane wydatki albo zmniejsz kwoty.';
        $('propertyAcquisition').focus(); return;
      }
      $('totalHousing').value=core.formatNumber(sum);
    }
    detailed=next; $('detailed').checked=next; $('category-panel').hidden=!next; $('total-field').hidden=next;
    render();
  }
  const examples={partial:['200000','150000','180000'],none:['200000','150000','0'],full:['200000','150000','200000'],loss:['140000','150000','100000'],large:['2000000','1500000','1800000']};
  function loadExample(name) {
    const example=examples[name]; if(!example) return;
    for(const id of fields) $(id).value='';
    $('saleAmount').value=example[0]; $('acquisitionCosts').value=example[1]; $('totalHousing').value=example[2];
    detailed=false; $('detailed').checked=false; $('category-panel').hidden=true; $('total-field').hidden=false;
    $('selling-details').open=false; $('cost-details').open=false; touched=false;
    for(const id of fields) formatInput($(id)); render();
  }
  for(const id of fields) {
    $(id).addEventListener('input',()=>{touched=true;$(id).classList.toggle('compact',$(id).value.length>16);$('example').value='custom';render();});
    $(id).addEventListener('blur',()=>{formatInput($(id));render();});
  }
  $('example').addEventListener('change',()=>loadExample($('example').value));
  $('detailed').addEventListener('change',()=>setDetailed($('detailed').checked));
  $('reset').addEventListener('click',()=>{
    for(const id of fields) $(id).value='';
    detailed=false; touched=false; $('detailed').checked=false; $('category-panel').hidden=true; $('total-field').hidden=false;
    $('example').value='custom'; $('selling-details').open=false; $('cost-details').open=false; render(); $('saleAmount').focus();
  });
  $('calculator-form').addEventListener('submit',event=>{
    event.preventDefault(); touched=true;
    for(const id of fields) formatInput($(id));
    const result=render();
    if(!result.ok) {
      const id=Object.keys(result.errors)[0]; const target=!detailed&&core.expenseKeys.includes(id)?'totalHousing':id;
      $(target).focus();
    } else { $('wynik').focus(); $('wynik').scrollIntoView({behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}); }
  });
  loadExample('partial');
})();
