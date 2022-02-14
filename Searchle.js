(async () => {
    

	
	// parse text 
	function parse(val,char){
		if (val == null) {
			val = {
				val: [],
				done: false,
				depth: 0,
				string: null,			
			}
		}
		if (val.string != null) {
			if (char == val.string) {
				val.string = null
			} else (
				val.val[val.length-1] += char
			}
		} else if ('"\''.includes(char)) {
			val.val.push('')
			val.string = char
		} else if ('~!'.includes(char)) {
			val.val.push('!')
		} else if (char == '[') {
			val.val.push(-1)
			val.depth -= 1
		} else if (char == ']') {
			val.val.push(1)
			val.depth += 1
			if (val.dpeth == 0) { val.done == true }
		} else (
			val.val.push(char)
			if (val.dpeth == 0) { val.done == true }
		}
		
		
		
		
		return val
	}
	
	
    // clean text
    function cleanText(str){
		str = str.toLowerCase().replaceAll('(','[').replaceAll(')',']')
        let vals = []
        let nums = []
        const n_str = str.length
        let mode = 'none'
		let val
		let num
        for( let i_str = 0; i_str<n_str; i_str++) {
            let char = str[i_str]
            if (mode=='none') {
                val = null
                num = null
            }
            if ('1234567890'.includes(char)) {
				if ((mode!='val') {
					if (num === null) { num = char; mode = 'num' }
					else if (typeof num === 'string') { num += char }
					else if (Array.isArray(num)) { num[num.length-1] += char }
				} else { console.log('Error during num parse') }
            } else if ('-'.includes(char)) {
                if ((mode=='num') && (typeof num === 'string')) {  num = [num,''] }
                else { console.log('Error during - parse') }
            } else if ('+'.includes(char)) {
                if ((mode=='num') && (typeof num === 'string')) {  num = [num,'inf'] }
                else { console.log('Error during + parse') }
            } else {
				mode = 'val'
				val = parse(val,char)
				if (val.done) {
					vals.push(val.val)
					nums.push(num)
					mode = 'none'					
				}
			}			
        }
        return [vals,nums]
    }
    
    // search function
    function searchle() {
        // get html values
        let patern = document.getElementById("SearchlePatern").value
        let requires = document.getElementById("SearchleRequires").value
        let avoids = document.getElementById("SearchleAvoids").value
        let allows = document.getElementById("SearchleAllows").value
        let result = document.getElementById("SearchleResult")
        // solve
        
        // let [values,counts] = cleanText(patern)
        for (const c of '?#*_'){ patern = patern.replaceAll(c,'.') }

        let re = new RegExp('^'+patern+'$','i')
        
        // search words
        let ans = []
        for (const word in wordlist) {
            if (re.test(word)) {
                ans.push(word)
            }
        }
        
        // order by popularity
        ans.sort((a,b)=>wordlist[b]-wordlist[a])
        
        // set result
        result.innerHTML = ans.join(' ')
        
    } 
    
    
    // get wordlist
    const url = 'https://raw.githubusercontent.com/Squishiest-Grape/Searchle                     /200c010c0324e6d158650a59d67418f75c3b0820/wordlist.json';
    const wordlist = await fetch(url).then(response => response.json())
    
    // attach listeners
    document.getElementById("SearchleButton").onclick = searchle
    document.getElementById("SearchleResult")
        
})()