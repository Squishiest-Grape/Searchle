const version = 'v0.1.4'

let optionDef = {
    'Lists To Use': new Option({'Proper Nouns': 'Avoid'}, new Option('Include',['Require', 'Include', 'Nothing', 'Avoid'])),
    'Sort By': new Option('Frequency',['Frequency','Alphabetically','Power','Wordle Score']),
    'Wordle Mode': new Option('Super Hard Mode',['Normal','Hard Mode','Super Hard Mode']),
    'Use Wordle Answer List': new Option(false),
    'Show Sort Value': new Option(false),
    'Frequency Requirement': new Option(''),
}  
    
class Option {
    constuctor(initial,option=null) {
        this.value = initial
        this.option = option
    }
}

async function searchleMain(document) {

    // replacement helper function
    function replace(str,old_chars,new_cha) {
        for (const c of old_chars) { str = str.replaceAll(c,new_cha) }
        return str
    }
    
    // main parser
    function parse(str) {
        str = str.toLowerCase()
        str = replace(str,' ,','')
        let ANS = []
        let val = null
        let num = null
        let inv = false
        let i_str = 0
        let n_str = str.length
        let depth = 0
        let mode = null
        while (i_str < n_str) {
            // get character
            let cha = str[i_str] 
            // handle strings
            if ('"\''.includes(mode)) {
                if (cha == mode) { mode = 'done' }
                else { val += cha }
            // handle groups
            } else if ('(['.includes(mode)) {
                if (cha == mode ) { depth -= 1 }
                if ((mode=='[' && cha==']')||(mode=='(' && cha==')')) { depth += 1 }
                if (depth != 0) { val += cha }
                else { 
                    val = parse(val)
                    mode = 'done' 
                }                
            } else {
                // starting strings and groups
                if ('"\'[('.includes(cha)) {
                    val = ''
                    mode = cha        
                    if ('(['.includes(cha)){ depth = -1 }
                // handle numbers
                } else if ('1234567890-+'.includes(cha)) {
                    mode = 'num'
                    if ('1234567890'.includes(cha)) {
                        if (num == null) { num = cha }
                        else if (typeof num == 'string') { num += cha }
                        else if (Array.isArray(num)) { num[num.length-1] = num[num.length-1] + cha }
                    } else if ('-+'.includes(cha)) { 
                        num = [num,'']
                    }
                // handle inverse
                } else if ('!~^'.includes(cha)) {
                    inv = !inv
                // handle other chcarters
                } else {
                    mode = 'done'
                    if (!'#*_?.'.includes(cha)) { val = cha }        
                }
            }
            // handle saving new value
            if (mode == 'done') {
                if (Array.isArray(num)) { num = num.map(i => parseInt(i)) }
                else if (num != null) { num = parseInt(num) }
                ANS.push([num,val,inv])
                mode = null
                val = null
                num = null
                inv = false
            }
            i_str += 1
        }
        // handle partial completion for numbers
        if (num != null) {
            if (Array.isArray(num)) { num = num.map(i => parseInt(i)) }
            else if (num != null) { num = parseInt(num) }
            ANS.push([num,null,inv])
        }
        return ANS
    }
    
    // parse to string
    function pattern2regex(pattern) {
        let ans = ''
        for (let [num,val,inv] of pattern) {
            if (Array.isArray(val)) {
                ans += '['
                if (inv) { ans += '^' }
                ans += val.map(v=>pattern2regex([v])).join('|')
                ans += ']'        
            } else {
                if (val == null) { val = '.' }
                if (inv) { ans += '[^' + val + ']' }
                else { ans += val }                
            }
            if (num != null) {
                if (Array.isArray(num)) {
                    if (num[1] == NaN) {
                        ans += '{'+String(num[0])+',}'
                    } else {
                        ans += '{'+String(num[0])+','+String(num[1])+'}'
                    }                    
                } else {
                    ans += '{'+String(num)+'}'
                }
            }
        }
        return ans
    }
    
    // search function
    function searchle() {
        
        let ans = ''
        
        try {
            // get html values
            let pattern = document.getElementById("searchlePattern").value
            let requires = document.getElementById("searchleRequires").value
            let avoids = document.getElementById("searchleAvoids").value

            // get limits
            let limits = {}

            avoids = parse(avoids)
            for (let i=0; i<avoids.length; i++) {
                let [num,val,inv] = avoids[i]
                if (Array.isArray(val)) { throw 'Groupings not implimented in avoids' }
                if (inv) { throw 'Inverse not implimented in avoids' }
                if (val == null) { throw 'Wildcards not implimented in avoids' }
                if (num == null) { num = [0,0] }
                else if (Array.isArray(num)) {
                    if (num[1] != NaN) { throw 'Multi-range not implimented' }
                    num = [0,num[0]]
                }
                else { num = [0,num] }
                if (val in limits) {
                    if (limits[val][0] > num[0]) { num[0] = limits[val][0] }
                    if ((num[1] == NaN) || (limits[val][1] < num[1])) { num[1] = limits[val][1] } 
                }
                limits[val] = num
            }

            requires = parse(requires)
            for (let i=0; i<requires.length; i++) {
                let [num,val,inv] = requires[i]
                if (Array.isArray(val)) { throw 'Groupings not implimented in requires' }
                if (inv) { throw 'Inverse not implimented in requires' }
                if (val == null) { throw 'Wildcards not implimented in requires' }
                if (num == null) { num = 1 }
                if (Array.isArray(num)) {
                    limits[val] = num
                } else {
                    if (val in limits) { limits[val] = [limits[val][0]+num,limits[val][1]+num] }
                    else { limits[val] = [num,NaN] }
                }
            }

            pattern = parse(pattern)
            pattern = pattern2regex(pattern)

            // solve  
            let re = new RegExp('^'+pattern+'$','i')

            ans = []
            for (const word of wordlist['words']) {
                if (re.test(word)) {
                let good = true
                for (const part in limits) {
                    let c = (word.match(new RegExp(part,'gi')) || []).length
                    if (c < limits[part][0] || c > limits[part][1]) {
                        good = false
                        break
                    }
                }
                if (good) { ans.push(word) } 
                }
            }
            ans  = ans.join('\n')
        } catch (error) {
            ans = error       
        }
        
        document.getElementById('searchleResult').innerHTML = ans
        activeTab('Results')
    } 
    
    function activeTab(name) {
        for (let e of document.getElementsByClassName('box')) { e.style.display = 'none' }
        for (let e of document.getElementsByClassName('tabBtn')) { e.className = e.className.replace(' active','') }
        document.getElementById('box'+name).style.display = 'block';
        for (let e of document.getElementsByClassName('tabBtn')) { if (e.innerHTML == name) { e.className += ' active' } }
    }
    
    function tabClick(event) {
        const name = event.srcElement.innerHTML
        activeTab(name)
    }
    
    function optionDef2values(optionDef) {
        options = {}
        for (const [key, value] of Object.entries(optionDef)) {
            options[key] = value.value   
        }
        return options    
    }
    
    function getCookies() {
        const rawCookies = document.cookie
        let cookies = {}
        for (const str of rawCookies.split(';')) {
            const [key,val] = str.split('=')
            cookies[key.trim()] = JSON.parse(val.trim())     
        }
        return cookies
    }

    function setCookies(cookies,days=30) {
        for (const [key,val] of Object.entries(cookies)) {
            const d = new Date()
            d.setTime(d.getTime() + (days*24*60*60*1000))
            document.cookie = key + '=' + JSON.stringify(val) + '; expires=' + d.toUTCString()    
        }
    }
    
    
    
    // get data
    let wordlist = await fetch('https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/data/wordlist.json').then(response => response.json())
    let helptext = await fetch('https://raw.githubusercontent.com/Squishiest-Grape/Searchle/main/docs/help.txt').then(response => response.text())
    let cookies = getCookies()
    console.log(cookies)
    
    // add info
    document.getElementById("boxInfo").innerHTML = helptext.replaceAll('\n','<br>')
    
    // add options 
    let options = optionDef2values(optionDef)
    cookies['options'] = options
    
    setCookies(cookies)
    cookies = getCookies()
    console.log(cookies)
    document.getElementById("boxOptions").innerHTML = 'Options not implmented'
    
    
    
    // attach button events
    document.getElementById("searchleBtn").onclick = searchle
    const tabs = document.getElementsByClassName('tabBtn')
    for (const e of tabs) { e.onclick = tabClick }
    
    activeTab('Info')
    console.log(`Loaded Serachle ${version}`)
    
}
