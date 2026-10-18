import re, json
from wordfreq import top_n_list, zipf_frequency
# Regenera public/words/<idioma>.txt (pip install wordfreq). Mantiene las palabras actuales y añade las formas de uso común.
def base(lang):
    return open(f'public/words/{lang}.txt').read().split('\n')
for lang in ['en','fr','de','it','pt','es']:
    b=base(lang)
    if lang!='en':
        bs=set(b)
        # Todas las palabras de uso común (frecuencia ≥ 3, unas 1 vez por millón): así entran conjugaciones, plurales y femeninos
        extra=[w for w in top_n_list(lang,120000) if w not in bs and w.isalpha() and len(w)>=2 and zipf_frequency(w,lang)>=3.0]
        b=b+extra
    seen=set(); out=[]
    for w in b:
        if w not in seen: seen.add(w); out.append(w)
    open(f'public/words/{lang}.txt','w').write('\n'.join(out))
    print(lang,len(out))
