Pod::Spec.new do |s|
  s.name           = 'DoomtypeExercise'
  s.version        = '1.0.0'
  s.summary        = 'Pushup counting and step reading for DOOMTYPE'
  s.description    = 'On-device body pose (Vision) camera view and CoreMotion step counter.'
  s.license        = 'UNLICENSED'
  s.author         = 'DOOMTYPE'
  s.homepage       = 'https://github.com/baylor-MBDev/Brainsaver'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/baylor-MBDev/Brainsaver.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'Vision', 'CoreMotion'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
