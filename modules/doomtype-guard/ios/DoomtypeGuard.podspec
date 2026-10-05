Pod::Spec.new do |s|
  s.name           = 'DoomtypeGuard'
  s.version        = '1.0.0'
  s.summary        = 'Gate handoff for DOOMTYPE on iOS'
  s.description    = 'Turns a tap on the Screen Time shield notification into a pending gate.'
  s.license        = 'UNLICENSED'
  s.author         = 'DOOMTYPE'
  s.homepage       = 'https://github.com/baylor-MBDev/Brainsaver'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/baylor-MBDev/Brainsaver.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UserNotifications'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
