module.exports = function (grunt) {

   var STREAM_SOURCE_PORT = 4567;

   // NB: source files are order sensitive
   var OBOE_SOURCE_FILES = [
      'src/functional.js'                
   ,  'src/util.js'                    
   ,  'src/lists.js'                    
   ,  'src/libs/polyfills.js'
   ,  'src/libs/clarinet.js'               
   ,  'src/clarinetListenerAdaptor.js'
   ,  'src/streamingXhr.js'
   ,  'src/jsonPathSyntax.js'
   ,  'src/incrementalContentBuilder.js'            
   ,  'src/jsonPath.js'
   ,  'src/pubsub.js'
   ,  'src/events.js'
   ,  'src/instanceController.js'
   ,  'src/browserApi.js'
   ];
   
   var FILES_TRIGGERING_KARMA = [
      'src/**/*.js', 
      'test/specs/*.spec.js', 
      'test/libs/*.js'
   ];
     
   grunt.initConfig({

      pkg:grunt.file.readJSON("package.json")
      
   ,  clean: ['dist/*.js', 'build/*.js']
      
   ,  concat: {
         oboe:{         
            src: OBOE_SOURCE_FILES,
            dest: 'build/oboe.concat.js'
         }
      }
      
   ,  wrap: {
         browserPackage: {
            src: 'build/oboe.concat.js',
            dest: '.',
            wrapper: [
               '// this file is the concatenation of several js files. See https://github.com/jimhigson/oboe.js/tree/master/src ' +
                   'for the unconcatenated source\n' +
               // having a local undefined, window, Object etc allows slightly better minification:                    
               '(function  (window, Object, Array, Error, undefined ) {' 
            ,           '})(window, Object, Array, Error);'
            ]
         }
      }      
            
   ,  uglify: {
         build:{
            files:{
               'build/oboe.min.js': 'build/oboe.concat.js'
            }
         }
      }
      
   ,  karma: {
         options:{            
            singleRun: true,
            proxies: {
               '/testServer'   : 'http://localhost:' + STREAM_SOURCE_PORT   
            },         
            // test results reporter to use
            // possible values: 'dots', 'progress', 'junit'
            reporters : ['progress'],
                        
            // enable / disable colors in the output (reporters and logs)
            colors : true            
         }
         
      ,  
         'precaptured-dev': {
            // for doing a single test run with already captured browsers during development.
            // this is good for running tests in browsers karma can't easily start such as
            // IE running inside a Windows VM on a unix dev environment                
            browsers: [],     
            configFile: 'test/unit.conf.js',
            singleRun: 'true'            
         }
      ,
         'single-dev': {
            browsers: ['Chrome', 'Firefox', 'Safari'],
            configFile: 'test/unit.conf.js'
         }
      ,
         'single-concat': {
            browsers: ['Chrome', 'Firefox', 'Safari'],
            configFile: 'test/concat.conf.js'      
         }  
      ,  
         'single-minified': {
            browsers: ['Chrome', 'Firefox', 'Safari'],
            configFile: 'test/min.conf.js'
         }
         
      ,  
         'persist': {
            // for setting up a persistent karma server.
            // To start the server, the task is:
            //    karma:persist 
            // To run these, the task is: 
            //    karma:persist:run
            configFile: 'test/unit.conf.js',           
            browsers: [], 
            singleRun:false,
            background:true
         }   
      }
      
   ,  copy: {
         dist: {
            files: [
               {src: ['build/oboe.min.js'],    dest: 'dist/oboe.min.js'}
            ,  {src: ['build/oboe.concat.js'], dest: 'dist/oboe.js'    }
            ]
         }
      }      
      
   ,  exec:{
         // these might not go too well on Windows :-) - get Cygwin.
         reportMinifiedSize:{
            command: "echo Minified size is `wc -c < dist/oboe.min.js` bytes" 
         },
         reportMinifiedAndGzippedSize:{
            command: "echo Size after gzip is `gzip --best --stdout dist/oboe.min.js | wc -c` bytes"
         }
      }
      
   ,  watch:{
         karma:{
            files:FILES_TRIGGERING_KARMA,
            tasks:['karma:persist:run']
         },
         
         // like above but reports the file size. This is good for 
         // watching while developing to make sure it doesn't get
         // too big. Doesn't run tests against minified.
         karmaAndSize:{
            files: FILES_TRIGGERING_KARMA,
            tasks:[
               'karma:persist:run',
               'concat:oboe', 
               'wrap:browserPackage', 
               'uglify',
               'copy:dist',               
               'dist-sizes']
         },
         
         restartStreamSourceAndRunTests:{
            // this fails at the moment because start-stream-source
            // fails if run more than once - the port is taken.
            files: ['test/streamsource.js'],
            tasks: ['start-stream-source', 'karma:persist:run']
         }         
      }
                 
   ,  concurrent:{
         watchDev: {
            tasks:[ 'watch:karmaAndSize', 'watch:restartStreamSourceAndRunTests' ],
            options:{
               logConcurrentOutput: true
            }
         }
      }
      
   });

   require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

   var streamSource;
   
   grunt.registerTask('start-stream-source', function () {
      grunt.log.ok('do we have a streaming source already?', !!streamSource);
   
      // if we previously loaded the streamsource, stop it to let the new one in:
      if( streamSource ) {
         grunt.log.ok('there seems to be a streaming server already, let\'s stop it');
         streamSource.stop();
      }
         
      grunt.log.ok('let\'s get a streaming server started');
      streamSource = require('./test/streamsource.js');
      streamSource.start(STREAM_SOURCE_PORT, grunt);
      grunt.log.ok('we started it, but does it work?', streamSource);  
   });
   
   grunt.registerTask('test-start-server',   [
      'karma:persist'
   ]);
   
   grunt.registerTask('test-run',   [
      'karma:persist:run'
   ]);
   
   // test-auto-run
   //
   // The most useful for developing. Start this task, capture some browsers
   // then edit the code. Tests will be run as the code is saved.
   grunt.registerTask('test-auto-run',   [
      'start-stream-source',
      'karma:persist',
      'concurrent:watchDev'       
   ]);      

   grunt.registerTask('dist-sizes',   [
      'exec:reportMinifiedSize',
      'exec:reportMinifiedAndGzippedSize'
   ]);
   
   // dev-test
   //
   // For one-off test runs while developing. Capture browsers first. Allows
   // to capture IE running in VM which would be tricky to set up starting
   // automatically though Karma   
   grunt.registerTask('dev-test',     [
      'clear',
      'start-stream-source',         
      'karma:precaptured-dev'
   ]);
   
   grunt.registerTask('default',      [
      'clear',   
      'start-stream-source',
      'karma:single-dev', 
      'concat:oboe', 
      'wrap:browserPackage', 
      'uglify',
      'copy:dist',
      'karma:single-concat',                                         
      'karma:single-minified',
      'dist-sizes'                                          
   ]);

};