import re, json
from nltk.corpus import words as nltk_set
from english_words import english_words_set
import wordfreq 

#%%

class Words():
    def __init__(self):
        self.words = {}  
        self.lists = {'Proper Nouns':[]}
        self.freq = []
        self.excluded = set()
    def add_word(self,word,name,check_capital=True):
        w = word.lower()
        if re.search('[^a-z]',word): self.excluded.add(w); return
        if w not in self.words: self.words[w] = {
            'upper': False,
            'lower': False,
            'list': [name],
            'freq': wordfreq.word_frequency(w, 'en', 'large'),
            }
        else: self.words[w]['list'].append(name)
        if check_capital:
            if re.search('[A-Z]', word): self.words[w]['upper'] = True
            else:                        self.words[w]['lower'] = True
    def add_list(self,name,words):
        print(f"Adding {name} - {len(words)} words")
        if name not in self.lists: self.lists[name] = []
        has_capital = any(re.search('[A-Z]', word) for word in words)
        for word in words: self.add_word(word, name, has_capital)
    def add_lists(self,lists):
        for name,words in lists.items(): self.add_list(name,words)
    def finish(self):
        self.words = {w:d for p,(w,d) in sorted(zip([d['freq'] \
                            for d in self.words.values()],self.words.items()))}
        for i,(word,info) in enumerate(self.words.items()):
            for L in info['list']:
                self.lists[L].append(i)
            if info['upper'] and not info['lower']:
                self.lists['Proper Nouns'].append(i)
            self.freq.append(info['freq'])
        self.words = list(self.words.keys())
    def dict(self):            
        return dict(words=self.words,freq=self.freq,lists=self.lists)

#%%

if __name__ == '__main__':
    
    words = Words()
    
    # add basic word lists
    words.add_list('English Words', list(wordfreq.iter_wordlist('en','large')))
    words.add_list('English Words', nltk_set.words())
    words.add_list('English Words', english_words_set)

    # add wordle lists
    with open('Data/WordleSolutions.txt', 'r') as fs, \
            open('Data/WordleGuesses.txt', 'r') as fg:
        words_s = fs.read().split('\n')
        words_g = fg.read().split('\n')
        words.add_list('Wordle Solutions', words_s)
        words.add_list('Wordle', words_s + words_g)

    # clean up
    words.finish()
    
#%%
    # save
    print('Saving Wordlist')
    with open("Data/Wordlist.json", "w") as outfile:
        json.dump(words.dict(),outfile)
