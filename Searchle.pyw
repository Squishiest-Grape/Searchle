import re, json

# from nltk.corpus import words
# from wordfreq import word_frequency
# word_list = words.words()
# word_list = {word:word_frequency(word,'en') for word in word_list}
# with open("wordlist.json", "w") as outfile:
#     json.dump(word_list, outfile)

with open("wordlist.json", "r") as infile:
    word_list = json.load(infile)



def find_words(mask,contains='',avoids='',allows=''):

    if allows == '': allows = 'abcdefghijklmnopqrstuvwxyz'
    for c in avoids: allows = allows.replace(c,'')

    contains = {c:contains.count(c) for c in set(contains)}
    count = {c:mask.count(c) for c in contains}
    
    for i,c in enumerate(contains):
        if c not in allows and contains[i] > count[i]:
            allows += c
    
    
    mask = '\A' + ''.join([c if c not in '*?_#@!&-' else f'[{allows}]' for c in mask]) + '\Z'
    
    mask = re.compile(mask,re.IGNORECASE)

    ans = []
    for word in word_list:
        if mask.search(word):
            cont = True
            for i,c in enumerate(contains):
                if word.count(c) - count[c] < contains[c]: 
                    cont = False
            if cont: ans.append(word)
    
    ans = [w for _,w in sorted(zip([word_list[word] for word in ans],ans))][::-1]
    
    return ans



import tkinter as tk
class MainWindow(tk.Tk):
    def __init__(self):
        tk.Tk.__init__(self)
        self.title("Searchle")
        tk.Button(self,text='Searchle',command=self.run).grid(row=0,column=0,columnspan=1)
        tk.Label(self,text='Given: ').grid(row=1,column=0)
        self.given = tk.Entry(self,validatecommand=self.run)
        self.given.grid(row=1,column=1)
        tk.Label(self,text='Contains: ').grid(row=2,column=0)
        self.contains = tk.Entry(self,validatecommand=self.run)
        self.contains.grid(row=2,column=1)
        tk.Label(self,text='Avoids: ').grid(row=3,column=0)
        self.avoids = tk.Entry(self,validatecommand=self.run)
        self.avoids.grid(row=3,column=1)
        tk.Label(self,text='Allows: ').grid(row=4,column=0)
        self.allows = tk.Entry(self,validatecommand=self.run)
        self.allows.grid(row=4,column=1)
        self.ans = tk.Text(self,state='disabled')
        self.ans.grid(row=0,column=2,rowspan=5,sticky="nsew")
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
    def run(self):
        ans = find_words(self.given.get(),self.contains.get(),self.avoids.get(),self.allows.get())
        self.ans.config(state='normal')
        self.ans.delete('1.0', tk.END)
        self.ans.insert(tk.INSERT,'\n'.join(ans))
        self.ans.config(state='disabled')

main = MainWindow()
main.mainloop()





