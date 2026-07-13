cmake_minimum_required(VERSION 3.16)
project(ptx-json LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PTFORMAT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/ptformat")

if(NOT EXISTS "${PTFORMAT_DIR}/ptformat.cc")
  message(FATAL_ERROR "ptformat source not found. Run: git clone https://github.com/zamaudio/ptformat.git ${PTFORMAT_DIR}")
endif()

add_library(ptformat STATIC
  ${PTFORMAT_DIR}/ptformat.cc
)
target_include_directories(ptformat PUBLIC ${PTFORMAT_DIR})

add_executable(ptx-json main.cpp)
target_link_libraries(ptx-json PRIVATE ptformat)

if(WIN32)
  target_compile_definitions(ptx-json PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()
