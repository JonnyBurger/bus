module.exports = function(grunt) {
	grunt.initConfig({
		watch: {
			src: {
				files: ['app.js']
			},
			less: {
				files: ['style.less'],
				tasks: ['less'],
				options: {
					livereload: false
				}
			},
			css: {
				files: ['style.css'],
				options: {
					livereload: true
				}
			},
			html: {
				files: ['index.html']
			},
			options: {
				livereload: true
			}
		},
		less: {
			production: {
				files: {
					"style.css": "style.less"
				}
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.registerTask('default', ['watch']);
}