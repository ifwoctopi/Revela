Pod::Spec.new do |s|
  s.name = 'RevelaVision'
  s.version = '1.0.0'
  s.summary = 'Offline Core ML inference for Revela'
  s.description = 'Loads the Revela skin classifier and returns sigmoid probabilities.'
  s.author = 'Revela'
  s.homepage = 'https://revela.local'
  s.license = { type: 'MIT' }
  s.platforms = { ios: '15.1' }
  s.source = { git: 'https://github.com/expo/expo.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.resources = 'ios/**/*.{mlmodel,mlmodelc}'
end
