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
		},
		'ftp-deploy': {
			build: {
				auth: {
					host: 'bus.herobo.com',
					port: 21,
					authKey: 'default'
				},
				src: '/Users/jonnyburger/Desktop/bus',
				dest: '/public_html',
				exclusions: ['node_modules', '.git', '.ftppass', 'Gruntfile.js', 'index.js', 'package.json', 'style.less', '.DS_Store']
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-ftp-deploy');
	grunt.registerTask('default', ['watch']);
	grunt.registerTask('deploy', ['ftp-deploy']);
}