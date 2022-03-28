#%%

import re, json, math
from nltk.corpus import words as nltk_set
from english_words import english_words_set
import wordfreq 

#%%

class Words():
    def __init__(self):
        self.words = {}  
        self.list_names = set()
        self.excluded = set()
        self.saved = None
    def add_word(self,word,name,check_capital=True):
        w = word.lower().strip()
        if re.search('[^A-Za-z]',word): self.excluded.add(w); return
        if len(w) == 0: return
        f = wordfreq.word_frequency(w, 'en', 'large')
        if w not in self.words: self.words[w] = {
            'upper': False,
            'lower': False,
            'list': [name],
            'freq': math.inf if f==0 else round(1/f),
            }
        else: self.words[w]['list'].append(name)
        if check_capital:
            if re.search('[A-Z]', word): self.words[w]['upper'] = True
            else: self.words[w]['lower'] = True
    def add_list(self,name,words):
        print(f"Adding {len(words)} words to {name}")
        self.list_names.add(name)
        check_capital = any(re.search('[A-Z]', word) for word in words)
        for word in words: self.add_word(word, name, check_capital)
    def sort(self):
        self.words = {w:d for p,(w,d) in sorted(  # sort by frequency
            zip([d['freq'] for d in self.words.values()],
                self.words.items()))}
    def save(self,file):
        self.sort()
        lists = {'Proper Nouns': []}
        for k in self.list_names: lists[k] = []
        freq = []
        for i,(word,info) in enumerate(self.words.items()):
            for L in info['list']:
                lists[L].append(i)
            if info['upper'] and not info['lower']:
                lists['Proper Nouns'].append(i)
            freq.append(info['freq'])
        words = list(self.words.keys())
        self.saved = dict(words=words,freq=freq,lists=lists)
        print(f'Saving words to {file}')
        with open(file, "w") as outfile:
            json.dump(self.saved,outfile)


#%%

if __name__ == '__main__':
    
    words = Words()
    
    # add basic word lists
    words.add_list('Exquisite Corpus', list(wordfreq.iter_wordlist('en','large')))
    words.add_list('Natural Language Toolkit', nltk_set.words())
    words.add_list("Webster's Second International", english_words_set)
    # add scrabble words
    with open('scrabble_words.txt', 'r') as f:
        words_s = f.read().split('\n')
        words.add_list('Scrabble', words_s) 
    # add wordle lists
    with open('wordle_solutions.txt', 'r') as fs, \
            open('wordle_guesses.txt', 'r') as fg:
        words_s = fs.read().split('\n')
        words_g = fg.read().split('\n')
        words.add_list('Wordle Solutions', words_s)
        words.add_list('Wordle', words_s + words_g)   

    # clean up
    words.save('wordlist.json')
