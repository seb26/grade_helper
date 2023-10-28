class Clip {

    constructor(number) {
        function begin_function() {
            console.log('begin_function - can i run this?');
        }
        console.log('construct');
        begin_function();
        if ( number > 0 ) {
            return true;
        }
        else {
            return false;
        }
    }
    

}

var clip_rough = new Clip(1);

console.log(clip_rough);
console.log( ( clip_rough.duration ) );