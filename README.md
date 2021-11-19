## Method
We built the structure of our project around a set that contained pages that have already been visited. Doing this allowed us to quickly determine if a page had already been visited. To traverse to new pages 
we would find all links in the page and compare them to what had been visited, then go through the pages that hadn't been visited where the whole process was repeated.
Login was slightly more complicated as we needed to constantly be updating our csrf tokens and our session id, but that didn't cause any huge issues. 
There were a few issues caused by figuring out how requests were formatted and keeping sockets alive, but those were the main obstacles.
## Testing
Testing involved some trial and error when figuring out the requests, but the logic of the program was simple and mostly revolved around getting all of the flags. Seeing how fields 
in the request changed the result was also part of the testing process.
