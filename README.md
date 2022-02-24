# Searchle

A pattern search tool for the english language.  Returns potential words sorted by frequency. 

- General wildcards can be made with ? # * _ or .
  - Specific wildcards can be made with groups using () or []
  - Disallow letters or groupings with ! ~ or ^
- Letter counts can be specified with a preceeding # #-# or #+
- Substrings can be made with '' or ""
- Requires and avoids can be used to require leters or ranges
- Spaces, commas, and capitalization are ignored
