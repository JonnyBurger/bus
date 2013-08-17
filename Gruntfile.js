module.exports = function(grunt) {
	grunt.initConfig({
		watch: {
			src: {
				files: ['public/app.js']
			},
			less: {
				files: ['public/style.less'],
				tasks: ['less'],
				options: {
					livereload: false
				}
			},
			css: {
				files: ['public/style.css'],
				options: {
					livereload: true
				}
			},
			html: {
				files: ['public/index.html']
			},
			options: {
				livereload: true
			}
		},
		less: {
			production: {
				files: {
					"public/style.css": "public/style.less"
				}
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.registerTask('default', ['watch']);
}